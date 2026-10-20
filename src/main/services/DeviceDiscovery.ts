import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import dgram from 'node:dgram';
import { exec } from 'node:child_process';
import { BrowserWindow } from 'electron';
import { DeviceStore } from './DeviceStore';
import { KvmDevice } from '../../shared/types/device';

export interface DiscoveredNanoKvm {
  ip: string;
  port: number;
  protocol: 'http' | 'https';
  hostname?: string;
  model: 'nanokvm-go' | 'nanokvm-lite' | 'nanokvm-full' | 'generic-kvm';
  name: string;
  isNew: boolean;
}

export class DeviceDiscovery {
  private store: DeviceStore;
  private isScanning = false;
  private discoveryInterval: NodeJS.Timeout | null = null;

  constructor(store: DeviceStore) {
    this.store = store;
  }

  public startPeriodicDiscovery(intervalMinutes = 2): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    // Initial scan after 4 seconds
    setTimeout(() => {
      this.scanLan({ fullSubnet: false }).catch(() => {});
    }, 4000);

    this.discoveryInterval = setInterval(() => {
      this.scanLan({ fullSubnet: false }).catch(() => {});
    }, intervalMinutes * 60 * 1000);
  }

  public stopPeriodicDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
  }

  /**
   * Scans local network for NanoKVM devices.
   */
  public async scanLan(options: { fullSubnet?: boolean } = {}): Promise<DiscoveredNanoKvm[]> {
    if (this.isScanning) {
      console.log('[DeviceDiscovery] Scan already in progress, skipping duplicate call.');
      return [];
    }

    this.isScanning = true;
    console.log('[DeviceDiscovery] Starting LAN discovery for NanoKVM devices...');

    try {
      const candidateIps = new Set<string>();

      // 1. Get active neighbor IPs from OS ARP cache (fastest, near-instantaneous)
      const arpIps = await this.getArpIps();
      arpIps.forEach((ip) => candidateIps.add(ip));

      // 2. Add IPs and resolve .local hostnames for all registered devices
      for (const d of this.store.getDevices()) {
        if (d.resolvedIp) candidateIps.add(d.resolvedIp);
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(d.host)) candidateIps.add(d.host);
        const hostToLookup = d.originalHost || (d.host.includes('.local') ? d.host : null);
        if (hostToLookup) {
          try {
            const resolved = await this.resolveHostIPv4(hostToLookup);
            if (resolved && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(resolved)) {
              candidateIps.add(resolved);
            }
          } catch {}
        }
      }

      // 3. If fullSubnet requested or ARP returned few entries, expand to subnet IPs
      if (options.fullSubnet || candidateIps.size <= 2) {
        const subnetIps = this.getLocalSubnetIps();
        subnetIps.forEach((ip) => candidateIps.add(ip));
      }

      console.log(`[DeviceDiscovery] Probing ${candidateIps.size} candidate IPs for NanoKVM signatures...`);

      const ipList = Array.from(candidateIps);
      const discoveredList: DiscoveredNanoKvm[] = [];

      // Concurrency limit of 25 parallel requests to avoid socket exhaustion
      const batchSize = 25;
      for (let i = 0; i < ipList.length; i += batchSize) {
        const batch = ipList.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(batch.map((ip) => this.probeIpForNanoKvm(ip)));

        for (const res of batchResults) {
          if (res.status === 'fulfilled' && res.value) {
            discoveredList.push(res.value);
          }
        }
      }

      console.log(`[DeviceDiscovery] Scan complete. Found ${discoveredList.length} NanoKVM device(s).`);

      // Sync discovered devices with store
      let storeUpdated = false;
      const currentDevices = this.store.getDevices();

      for (const discovered of discoveredList) {
        let existing = currentDevices.find(
          (d) =>
            d.host === discovered.ip ||
            d.resolvedIp === discovered.ip ||
            (discovered.hostname && (d.host === discovered.hostname || d.originalHost === discovered.hostname))
        );

        // If no direct IP/hostname match, check if there's an existing primary device whose previous IP is offline
        if (!existing) {
          const offlineCandidate = currentDevices.find(
            (d) => d.id === 'device-nanokvm-local' || (d.tags?.includes('principal') && d.host !== discovered.ip)
          );
          if (offlineCandidate) {
            existing = offlineCandidate;
          }
        }

        if (existing) {
          discovered.isNew = false;
          let changed = false;
          if (existing.resolvedIp !== discovered.ip) {
            existing.resolvedIp = discovered.ip;
            changed = true;
          }
          if (discovered.hostname && existing.originalHost !== discovered.hostname) {
            existing.originalHost = discovered.hostname;
            existing.host = discovered.hostname;
            changed = true;
          }
          if (discovered.hostname && (existing.name.includes('nanokvm.local') || existing.name.includes('NanoKVM (192.'))) {
            existing.name = `NanoKVM (${discovered.hostname})`;
            changed = true;
          }
          if (changed) {
            this.store.saveDevice(existing);
            storeUpdated = true;
            console.log(`[DeviceDiscovery] Updated existing device ${existing.id} (${existing.name}) to ${discovered.hostname || discovered.ip} at IP ${discovered.ip}`);
          }
        } else {
          discovered.isNew = true;
          // Auto-register new discovered device
          const newDevice: KvmDevice = {
            id: `device-discovered-${discovered.ip.replace(/\./g, '-')}`,
            name: discovered.hostname ? `NanoKVM (${discovered.hostname})` : `NanoKVM (${discovered.ip})`,
            host: discovered.hostname || discovered.ip,
            originalHost: discovered.hostname,
            resolvedIp: discovered.ip,
            port: discovered.port,
            protocol: discovered.protocol,
            model: discovered.model,
            targetOS: 'auto',
            groupId: 'all',
            tags: ['autodiscovered', 'lan'],
            notes: `Detectado automaticamente na rede local (${discovered.ip})`,
            username: 'admin',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          this.store.saveDevice(newDevice);
          storeUpdated = true;
          console.log(`[DeviceDiscovery] Auto-registered new NanoKVM device: ${newDevice.name} at ${discovered.ip}`);
        }
      }

      if (storeUpdated) {
        this.broadcastDevicesUpdated();
      }

      return discoveredList;
    } catch (err: any) {
      console.warn('[DeviceDiscovery] Error during LAN scan:', err?.message);
      return [];
    } finally {
      this.isScanning = false;
    }
  }

  private resolveHostIPv4(host: string): Promise<string> {
    return new Promise((resolve) => {
      dns.lookup(host, { family: 4 }, (err, address) => {
        if (!err && address) {
          resolve(address);
        } else {
          resolve(host);
        }
      });
    });
  }

  /**
   * Probes a single IP address to verify if it runs the NanoKVM web interface.
   */
  private async probeIpForNanoKvm(ip: string): Promise<DiscoveredNanoKvm | null> {
    // Check HTTPS (443) first, then fallback to HTTP (80)
    for (const protocol of ['https', 'http'] as const) {
      const port = protocol === 'https' ? 443 : 80;
      const isHttps = protocol === 'https';
      const httpModule = isHttps ? https : http;

      const isKvm = await new Promise<boolean>((resolve) => {
        try {
          const req = httpModule.request(
            {
              protocol: `${protocol}:`,
              hostname: ip,
              port,
              path: '/',
              method: 'GET',
              family: 4,
              rejectUnauthorized: false,
              timeout: 1500,
              headers: {
                'User-Agent': 'Salmer-KVM-Discovery/1.0',
                Accept: 'text/html,application/json,*/*',
              },
            },
            (res) => {
              let body = '';
              res.on('data', (chunk) => {
                body += chunk;
                const lower = body.toLowerCase();
                // Early exit if signature matched in initial chunk
                if (lower.includes('nanokvm') || lower.includes('sipeed') || lower.includes('nano-kvm')) {
                  req.destroy();
                  resolve(true);
                }
              });
              res.on('end', () => {
                const lower = body.toLowerCase();
                const location = (res.headers.location || '').toLowerCase();
                const cookies = (res.headers['set-cookie'] || []).join(' ').toLowerCase();

                const hasSignature =
                  lower.includes('nanokvm') ||
                  lower.includes('sipeed') ||
                  lower.includes('nano-kvm') ||
                  lower.includes('desktop-tools') ||
                  lower.includes('desktop-') ||
                  location.includes('desktop') ||
                  location.includes('nanokvm') ||
                  cookies.includes('nano-kvm') ||
                  cookies.includes('kvm');

                resolve(hasSignature);
              });
            }
          );

          req.on('error', () => resolve(false));
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
          req.end();
        } catch {
          resolve(false);
        }
      });

      if (isKvm) {
        // Resolve actual mDNS .local hostname via multicast DNS PTR query
        const hostname = await this.resolveMdnsHostname(ip);
        return {
          ip,
          port,
          protocol,
          hostname,
          model: 'nanokvm-go',
          name: hostname ? `NanoKVM (${hostname})` : `NanoKVM (${ip})`,
          isNew: false,
        };
      }
    }

    return null;
  }

  /**
   * Resolves the actual mDNS .local hostname by querying multicast DNS (224.0.0.251:5353)
   * for the reverse PTR record (<reversed_ip>.in-addr.arpa).
   */
  private resolveMdnsHostname(ip: string, timeoutMs = 1200): Promise<string | undefined> {
    return new Promise((resolve) => {
      const parts = ip.split('.');
      if (parts.length !== 4) return resolve(undefined);
      const reversed = [...parts].reverse().join('.');
      const qnameParts = reversed.split('.');

      const buffers = [
        Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      ];
      for (const p of qnameParts) {
        buffers.push(Buffer.from([p.length]));
        buffers.push(Buffer.from(p, 'ascii'));
      }
      buffers.push(Buffer.from([0x07, 0x69, 0x6e, 0x2d, 0x61, 0x64, 0x64, 0x72]));
      buffers.push(Buffer.from([0x04, 0x61, 0x72, 0x70, 0x61]));
      buffers.push(Buffer.from([0x00, 0x00, 0x0c, 0x00, 0x01]));

      const packet = Buffer.concat(buffers);
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      let finished = false;
      const cleanup = () => {
        if (!finished) {
          finished = true;
          try {
            socket.close();
          } catch {}
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        // Fallback to unicast DNS reverse
        dns.reverse(ip, (err, hostnames) => {
          if (!err && hostnames && hostnames.length > 0) {
            resolve(hostnames[0]);
          } else {
            resolve(undefined);
          }
        });
      }, timeoutMs);

      socket.on('message', (msg) => {
        try {
          const localNeedle = Buffer.from([0x05, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x00]);
          const idx = msg.indexOf(localNeedle);
          if (idx > 0) {
            for (let len = 1; len <= 63; len++) {
              const start = idx - len - 1;
              if (start >= 0 && msg[start] === len) {
                const label = msg.subarray(start + 1, idx).toString('utf-8');
                if (label && /^[a-zA-Z0-9_-]+$/.test(label)) {
                  clearTimeout(timer);
                  cleanup();
                  return resolve(label + '.local');
                }
              }
            }
          }
        } catch {}
      });

      socket.on('error', () => {
        clearTimeout(timer);
        cleanup();
        resolve(undefined);
      });

      socket.bind(0, () => {
        try {
          socket.setBroadcast(true);
          socket.setMulticastTTL(255);
          socket.send(packet, 0, packet.length, 5353, '224.0.0.251');
        } catch {
          clearTimeout(timer);
          cleanup();
          resolve(undefined);
        }
      });
    });
  }

  /**
   * Retrieves active neighbor IPs from the OS ARP cache.
   */
  private getArpIps(): Promise<string[]> {
    return new Promise((resolve) => {
      exec('arp -a', { timeout: 2000 }, (err, stdout) => {
        if (err || !stdout) {
          return resolve([]);
        }
        const matches = stdout.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || [];
        // Filter out broadcast and multicast
        const valid = Array.from(new Set(matches)).filter((ip) => {
          return !ip.endsWith('.255') && !ip.startsWith('224.') && !ip.startsWith('239.') && !ip.startsWith('127.');
        });
        resolve(valid);
      });
    });
  }

  /**
   * Calculates IP range of the local active IPv4 subnet.
   */
  private getLocalSubnetIps(): string[] {
    const ips: string[] = [];
    const ifaces = os.networkInterfaces();

    for (const [name, addrs] of Object.entries(ifaces)) {
      if (name.startsWith('lo') || name.startsWith('utun') || name.startsWith('bridge')) {
        continue;
      }
      for (const a of addrs || []) {
        if (a.family === 'IPv4' && !a.internal && a.netmask === '255.255.255.0') {
          const parts = a.address.split('.');
          const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
          for (let host = 1; host <= 254; host++) {
            ips.push(`${prefix}.${host}`);
          }
        }
      }
    }

    return ips;
  }

  private broadcastDevicesUpdated(): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('devices-updated');
      }
    }
  }
}
