import { BrowserWindow } from 'electron';
import http from 'node:http';
import https from 'node:https';
import { DeviceStore } from './DeviceStore';
import { DeviceHealth, ConnectionStatus } from '../../shared/types/device';

export class HealthMonitor {
  private store: DeviceStore;
  private intervalTimer: NodeJS.Timeout | null = null;
  private isChecking = false;
  private healthCache: Map<string, DeviceHealth> = new Map();

  constructor(store: DeviceStore) {
    this.store = store;
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

    const health = await this.pingDevice(dev.protocol, dev.host, dev.port);
    this.healthCache.set(dev.id, health);
    this.broadcastUpdate();
    return health;
  }

  public async checkAllDevices(): Promise<Record<string, DeviceHealth>> {
    if (this.isChecking) return this.getHealthMap();
    this.isChecking = true;

    try {
      const devices = this.store.getDevices();
      const currentIds = new Set(devices.map((d) => d.id));

      // Clean up removed devices from cache
      for (const id of this.healthCache.keys()) {
        if (!currentIds.has(id)) {
          this.healthCache.delete(id);
        }
      }

      const promises = devices.map(async (dev) => {
        const health = await this.pingDevice(dev.protocol, dev.host, dev.port);
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

  private pingDevice(protocol: string, host: string, port: number): Promise<DeviceHealth> {
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

      const timeoutMs = 2500;
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
            hostname: host,
            port: port,
            path: `/?_health_t=${Date.now()}`,
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'User-Agent': 'Salmer-KVM-HealthCheck/1.0',
              'Accept': '*/*',
              'Connection': 'close',
            },
            agent: false, // Ensures a fresh TCP connection every time, preventing cached/stale socket reuse
            rejectUnauthorized: false, // Allows self-signed SSL certs commonly found on NanoKVMs
            timeout: timeoutMs,
          },
          (res) => {
            const latencyMs = Date.now() - startTime;
            // Status codes 200..499 confirm that device is powered on and web server is answering
            const isAlive = (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) || false;

            let status: ConnectionStatus = 'online';
            if (!isAlive) {
              status = 'degraded';
            } else if (latencyMs > 350 || (res.statusCode && res.statusCode >= 400 && res.statusCode !== 401)) {
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

