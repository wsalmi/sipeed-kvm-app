import { BrowserWindow, net } from 'electron';
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
    }

    // Run first check right away after 2 seconds
    setTimeout(() => this.checkAllDevices(), 2000);

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

  public async checkAllDevices(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const devices = this.store.getDevices();
      const promises = devices.map(async (dev) => {
        const health = await this.pingDevice(dev.protocol, dev.host, dev.port);
        this.healthCache.set(dev.id, health);
      });

      await Promise.allSettled(promises);
      this.broadcastUpdate();
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
      const url = `${protocol}://${host}:${port}/`;
      const startTime = Date.now();

      const request = net.request({
        method: 'GET',
        url,
        session: undefined,
      });

      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          request.abort();
          resolve({
            status: 'offline',
            lastChecked: Date.now(),
            errorMessage: 'Timeout (>3000ms)',
          });
        }
      }, 3000);

      request.on('response', (response) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          const latencyMs = Date.now() - startTime;
          const isOk = response.statusCode >= 200 && response.statusCode < 400;

          let status: ConnectionStatus = 'online';
          if (!isOk) {
            status = 'degraded';
          } else if (latencyMs > 350) {
            status = 'degraded';
          }

          resolve({
            status,
            latencyMs,
            lastChecked: Date.now(),
            videoSignal: true,
          });
        }
      });

      request.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            status: 'offline',
            lastChecked: Date.now(),
            errorMessage: err.message || 'Connection refused',
          });
        }
      });

      request.end();
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
