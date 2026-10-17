import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { KvmDevice, DeviceGroup } from '../../shared/types/device';
import { AppSettings } from '../../shared/types/session';

interface StoreData {
  version: number;
  devices: (Omit<KvmDevice, 'password'> & { encryptedPassword?: string })[];
  groups: DeviceGroup[];
  settings: AppSettings;
}

const DEFAULT_SETTINGS: AppSettings = {
  fullscreenShortcut: 'F11',
  healthCheckIntervalSec: 15,
  autoDiscoveryMdns: true,
  enableGamepadSupport: true,
  gamepadDeadzone: 0.15,
  theme: 'dark',
  defaultLayout: 'single',
};

const DEFAULT_GROUPS: DeviceGroup[] = [
  { id: 'all', name: 'Todos os Dispositivos', order: 0 },
  { id: 'datacenter', name: 'Datacenter / Servidores', color: '#38bdf8', order: 1 },
  { id: 'lab', name: 'Bancada Lab', color: '#4ade80', order: 2 },
  { id: 'mobile', name: 'Dispositivos Móveis', color: '#a78bfa', order: 3 },
  { id: 'tailscale', name: 'Remoto (Tailscale)', color: '#f59e0b', order: 4 },
];

const DEFAULT_DEVICES: StoreData['devices'] = [
  {
    id: 'device-nanokvm-local',
    name: 'NanoKVM Go (nanokvm.local)',
    host: 'nanokvm.local',
    port: 443,
    protocol: 'https',
    model: 'nanokvm-go',
    targetOS: 'macos',
    groupId: 'all',
    tags: ['local', 'principal'],
    notes: 'Dispositivo físico NanoKVM conectado via HTTPS',
    username: 'admin',
    encryptedPassword: Buffer.from('admin', 'utf-8').toString('base64'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'demo-nanokvm-go',
    name: 'NanoKVM Go - Bancada Lab',
    host: '192.168.1.120',
    port: 80,
    protocol: 'http',
    model: 'nanokvm-go',
    targetOS: 'macos',
    groupId: 'lab',
    tags: ['usbc', 'wifi6', 'mesa-principal'],
    notes: 'NanoKVM Go conectado via USB-C full-featured',
    username: 'admin',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 'demo-nanokvm-plus',
    name: 'NanoKVM Go+ Servidor Remoto',
    host: 'nanokvm-srv.tailscale.net',
    port: 443,
    protocol: 'https',
    model: 'nanokvm-go-plus',
    targetOS: 'linux',
    groupId: 'tailscale',
    tags: ['tailscale', 'remoto', 'datacenter'],
    notes: 'NanoKVM Go+ com AI e Memory Fabric via rede Tailscale',
    username: 'admin',
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
  },
];

export class DeviceStore {
  private filePath: string;
  private data: StoreData;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'sipeed-kvm-store.json');
    this.data = this.load();
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          version: parsed.version || 1,
          devices: Array.isArray(parsed.devices) && parsed.devices.length > 0 ? parsed.devices : DEFAULT_DEVICES,
          groups: Array.isArray(parsed.groups) && parsed.groups.length > 0 ? parsed.groups : DEFAULT_GROUPS,
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        };
      }
    } catch (err) {
      console.error('[DeviceStore] Failed to load store, initializing defaults:', err);
    }

    return {
      version: 1,
      devices: DEFAULT_DEVICES,
      groups: DEFAULT_GROUPS,
      settings: DEFAULT_SETTINGS,
    };
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DeviceStore] Failed to write store to disk:', err);
    }
  }

  private encrypt(value?: string): string | undefined {
    if (!value) return undefined;
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const buffer = safeStorage.encryptString(value);
        return buffer.toString('base64');
      }
      // Fallback if safeStorage is disabled/unavailable
      return Buffer.from(value, 'utf-8').toString('base64');
    } catch (err) {
      console.warn('[DeviceStore] Encryption failed, using fallback base64:', err);
      return Buffer.from(value, 'utf-8').toString('base64');
    }
  }

  private decrypt(encrypted?: string): string | undefined {
    if (!encrypted) return undefined;
    try {
      const buffer = Buffer.from(encrypted, 'base64');
      if (safeStorage.isEncryptionAvailable()) {
        try {
          return safeStorage.decryptString(buffer);
        } catch {
          return buffer.toString('utf-8');
        }
      }
      return buffer.toString('utf-8');
    } catch {
      return undefined;
    }
  }

  public getDevices(): KvmDevice[] {
    return this.data.devices.map((d) => {
      const hasStoredPassword = !!d.encryptedPassword;
      return {
        ...d,
        hasStoredPassword,
        password: this.decrypt(d.encryptedPassword),
      };
    });
  }

  public saveDevice(device: KvmDevice): KvmDevice {
    const existingIndex = this.data.devices.findIndex((d) => d.id === device.id);
    const encryptedPassword = device.password ? this.encrypt(device.password) : undefined;

    // Do not keep raw password in the saved JSON
    const { password, ...deviceWithoutRawPassword } = device;
    const toSave = {
      ...deviceWithoutRawPassword,
      encryptedPassword: encryptedPassword || (existingIndex >= 0 ? this.data.devices[existingIndex].encryptedPassword : undefined),
      updatedAt: Date.now(),
      createdAt: device.createdAt || Date.now(),
    };

    if (existingIndex >= 0) {
      this.data.devices[existingIndex] = toSave;
    } else {
      this.data.devices.push(toSave);
    }

    this.persist();
    return {
      ...device,
      hasStoredPassword: !!toSave.encryptedPassword,
      updatedAt: toSave.updatedAt,
    };
  }

  public deleteDevice(id: string): boolean {
    const prevCount = this.data.devices.length;
    this.data.devices = this.data.devices.filter((d) => d.id !== id);
    if (this.data.devices.length !== prevCount) {
      this.persist();
      return true;
    }
    return false;
  }

  public getGroups(): DeviceGroup[] {
    return this.data.groups;
  }

  public saveGroup(group: DeviceGroup): DeviceGroup {
    const idx = this.data.groups.findIndex((g) => g.id === group.id);
    if (idx >= 0) {
      this.data.groups[idx] = group;
    } else {
      this.data.groups.push(group);
    }
    this.persist();
    return group;
  }

  public deleteGroup(id: string): boolean {
    if (id === 'all') return false; // Prevent deleting default group
    const prevCount = this.data.groups.length;
    this.data.groups = this.data.groups.filter((g) => g.id !== id);
    if (this.data.groups.length !== prevCount) {
      this.persist();
      return true;
    }
    return false;
  }

  public getSettings(): AppSettings {
    return this.data.settings;
  }

  public saveSettings(settings: Partial<AppSettings>): AppSettings {
    this.data.settings = { ...this.data.settings, ...settings };
    this.persist();
    return this.data.settings;
  }

  public exportBackup(): string {
    return JSON.stringify(
      {
        version: this.data.version,
        exportedAt: Date.now(),
        devices: this.getDevices().map((d) => ({
          ...d,
          password: undefined, // Strip passwords on export for security
        })),
        groups: this.data.groups,
        settings: this.data.settings,
      },
      null,
      2
    );
  }

  public importBackup(jsonString: string): { success: boolean; importedCount: number } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed.devices)) {
        throw new Error('Invalid format: missing devices array');
      }

      let count = 0;
      for (const dev of parsed.devices) {
        if (dev.name && dev.host) {
          const deviceToSave: KvmDevice = {
            id: dev.id || `dev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: dev.name,
            host: dev.host,
            port: dev.port || 80,
            protocol: dev.protocol || 'http',
            model: dev.model || 'nanokvm-go',
            targetOS: dev.targetOS || 'auto',
            groupId: dev.groupId,
            tags: dev.tags || [],
            notes: dev.notes || '',
            username: dev.username || 'admin',
            createdAt: dev.createdAt || Date.now(),
            updatedAt: Date.now(),
          };
          this.saveDevice(deviceToSave);
          count++;
        }
      }

      if (Array.isArray(parsed.groups) && parsed.groups.length > 0) {
        for (const grp of parsed.groups) {
          this.saveGroup(grp);
        }
      }

      return { success: true, importedCount: count };
    } catch (err) {
      console.error('[DeviceStore] Import failed:', err);
      return { success: false, importedCount: 0 };
    }
  }
}
