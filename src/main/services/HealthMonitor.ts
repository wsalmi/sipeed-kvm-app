import { BrowserWindow } from 'electron';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { DeviceStore } from './DeviceStore';
import { DeviceDiscovery } from './DeviceDiscovery';
import { DeviceHealth, ConnectionStatus } from '../../shared/types/device';

export class HealthMonitor {
  private store: DeviceStore;
  private discoveryService?: DeviceDiscovery;
  private intervalTimer: NodeJS.Timeout | null = null;
  private isChecking = false;
  private healthCache: Map<string, DeviceHealth> = new Map();
  private resolvedHostCache: Map<string, { ip: string; expires: number }> = new Map();

  constructor(store: DeviceStore, discoveryService?: DeviceDiscovery) {
    this.store = store;
    this.discoveryService = discoveryService;
  }

  public start(): void {
    const settings = this.store.getSettings();
    const intervalMs = Math.max(5, settings.healthCheckIntervalSec || 15) * 1000;

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    // Run first check right away after 500ms
    setTimeout(() => this.checkAllDevices(), 500);

    this.intervalTimer = setInterval(() => {
      this.checkAllDevices();
    }, intervalMs);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public removeDevice(deviceId: string): void {
    this.healthCache.delete(deviceId);
    this.broadcastUpdate();
  }

  public async checkDevice(deviceId: string): Promise<DeviceHealth> {
    const devices = this.store.getDevices();
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev) {
      return { status: 'unknown' };
    }

    const health = await this.pingDeviceWithFallback(dev.protocol, dev.host, dev.port);
    this.healthCache.set(dev.id, health);
    this.broadcastUpdate();
    return health;
  }

  public async checkAllDevices(): Promise<Record<string, DeviceHealth>> {
    if (this.isChecking) return this.getHealthMap();
    this.isChecking = true;

    try {
      const settings = this.store.getSettings();
      const devices = this.store.getDevices();
      const currentIds = new Set(devices.map((d) => d.id));

      // Clean up removed devices from cache
      for (const id of this.healthCache.keys()) {
        if (!currentIds.has(id)) {
          this.healthCache.delete(id);
        }
      }

      // 1. Dynamically resolve all registered .local hosts in store
      await this.resolveAllRegisteredHosts();

      // 2. Run LAN Discovery if enabled
      if (settings.autoDiscoveryMdns && this.discoveryService) {
        this.discoveryService.scanLan({ fullSubnet: false }).catch(() => {});
      }

      const promises = devices.map(async (dev) => {
        const health = await this.pingDeviceWithFallback(dev.protocol, dev.host, dev.port, dev.originalHost);
        this.healthCache.set(dev.id, health);
      });

      await Promise.allSettled(promises);
      this.broadcastUpdate();
      return this.getHealthMap();
    } finally {
      this.isChecking = false;
    }
  }

  public getHealthMap(): Record<string, DeviceHealth> {
    const result: Record<string, DeviceHealth> = {};
    for (const [id, health] of this.healthCache.entries()) {
      result[id] = health;
    }
    return result;
  }

  /**
   * Resolves host to IPv4.
   * On macOS, mDNS returns IPv6 link-local addresses first by default, which causes
   * Node.js connection timeouts if not explicitly requesting IPv4.
   */
  public resolveHostIPv4(host: string): Promise<string> {
    return new Promise((resolve) => {
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
        return resolve(host);
      }

      const cached = this.resolvedHostCache.get(host);
      if (cached && cached.expires > Date.now()) {
        return resolve(cached.ip);
      }

      dns.lookup(host, { family: 4 }, (err, address) => {
        if (!err && address) {
          this.resolvedHostCache.set(host, { ip: address, expires: Date.now() + 60000 });
          resolve(address);
        } else {
          resolve(host);
        }
      });
    });
  }

  /**
   * Dynamically resolves mDNS or hostname for all registered devices in the store.
   * Eliminates hardcoded 'nanokvm.local' dependency: works with any custom name
   * like nanokvm-9AFC17.local, nanokvm-lab.local, etc.
   */
  private async resolveAllRegisteredHosts(): Promise<void> {
    const devices = this.store.getDevices();
    let storeChanged = false;

    for (const dev of devices) {
      const hostnameToResolve = dev.originalHost || (dev.host.includes('.local') ? dev.host : null);
      if (hostnameToResolve) {
        try {
          const resolvedIp = await this.resolveHostIPv4(hostnameToResolve);
          if (resolvedIp && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(resolvedIp)) {
            let deviceUpdated = false;
            if (dev.resolvedIp !== resolvedIp) {
              dev.resolvedIp = resolvedIp;
              deviceUpdated = true;
            }
            if (dev.host !== resolvedIp) {
              if (!dev.originalHost) {
                dev.originalHost = dev.host;
              }
              dev.host = resolvedIp;
              deviceUpdated = true;
            }
            if (deviceUpdated) {
              this.store.saveDevice(dev);
              storeChanged = true;
              console.log(`[HealthMonitor] Dynamically resolved ${hostnameToResolve} to IP ${resolvedIp} for device ${dev.name}`);
            }
          }
        } catch (err: any) {
          console.warn(`[HealthMonitor] Failed to resolve ${hostnameToResolve}:`, err?.message);
        }
      }
    }

    if (storeChanged) {
      this.broadcastDevicesUpdated();
    }
  }

  private async pingDeviceWithFallback(protocol: string, host: string, port: number, originalHost?: string): Promise<DeviceHealth> {
    // 1. Try pinging the configured host
    const firstResult = await this.pingDevice(protocol, host, port, originalHost);
    if (firstResult.status === 'online') {
      return firstResult;
    }

    // 2. If host or originalHost is a .local hostname and failed, force cache invalidation and re-resolve
    const localHost = (originalHost && originalHost.includes('.local')) ? originalHost : (host.includes('.local') ? host : null);
    if (localHost) {
      this.resolvedHostCache.delete(localHost);
      const resolvedIp = await this.resolveHostIPv4(localHost);
      if (resolvedIp && resolvedIp !== host) {
        const secondResult = await this.pingDevice(protocol, resolvedIp, port, localHost);
        if (secondResult.status === 'online') {
          return secondResult;
        }
      }
    }

    return firstResult;
  }

  private broadcastDevicesUpdated(): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('devices-updated');
      }
    }
  }

  private async pingDevice(protocol: string, host: string, port: number, originalHost?: string): Promise<DeviceHealth> {
    const targetHost = await this.resolveHostIPv4(host);

    return new Promise((resolve) => {
      const isHttps = protocol === 'https';
      const httpModule = isHttps ? https : http;
      const startTime = Date.now();
      let resolved = false;

      const finish = (result: DeviceHealth) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(result);
        }
      };

      const timeoutMs = 4000;
      const timer = setTimeout(() => {
        if (!resolved) {
          try {
            req.destroy(new Error('Timeout'));
          } catch {}
          finish({
            status: 'offline',
            lastChecked: Date.now(),
            errorMessage: `Timeout (>${timeoutMs}ms)`,
          });
        }
      }, timeoutMs);

      let req: http.ClientRequest;
      try {
        req = httpModule.request(
          {
            protocol: `${protocol}:`,
            hostname: targetHost,
            family: 4, // Explicitly enforce IPv4 to avoid IPv6 link-local timeouts on macOS
            port: port,
            path: `/?_health_t=${Date.now()}`,
            method: 'GET',
            headers: {
              'Host': originalHost || host,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'User-Agent': 'Salmer-KVM-HealthCheck/1.0',
              'Accept': '*/*',
              'Connection': 'close',
            },
            agent: false, // Fresh TCP connection every time
            rejectUnauthorized: false, // Self-signed SSL certs commonly found on NanoKVMs
            timeout: timeoutMs,
          },
          (res) => {
            const latencyMs = Date.now() - startTime;
            // Status codes 200..499 confirm device is powered on and web server is answering
            const isAlive = (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) || false;

            let status: ConnectionStatus = 'online';
            if (!isAlive) {
              status = 'degraded';
            } else if (latencyMs > 500 || (res.statusCode && res.statusCode >= 400 && res.statusCode !== 401)) {
              status = 'degraded';
            }

            res.resume(); // drain response stream

            finish({
              status,
              latencyMs,
              lastChecked: Date.now(),
              videoSignal: true,
            });
          }
        );

        req.on('timeout', () => {
          try {
            req.destroy(new Error('Timeout'));
          } catch {}
          finish({
            status: 'offline',
            lastChecked: Date.now(),
            errorMessage: `Timeout (>${timeoutMs}ms)`,
          });
        });

        req.on('error', (err) => {
          finish({
            status: 'offline',
            lastChecked: Date.now(),
            errorMessage: err.message || 'Connection refused',
          });
        });

        req.end();
      } catch (err: any) {
        finish({
          status: 'offline',
          lastChecked: Date.now(),
          errorMessage: err?.message || 'Connection initialization failed',
        });
      }
    });
  }

  private broadcastUpdate(): void {
    const windows = BrowserWindow.getAllWindows();
    const data = this.getHealthMap();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('device-health-update', data);
      }
    }
  }
}
