import { KvmDevice, DeviceGroup, DeviceHealth } from '../../shared/types/device';
import { AppSettings, KvmSpecialKey } from '../../shared/types/session';
import { KvmApi } from '../../main/preload';

const STORAGE_KEYS = {
  DEVICES: 'sipeed_kvm_devices',
  GROUPS: 'sipeed_kvm_groups',
  SETTINGS: 'sipeed_kvm_settings',
};

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

function getStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[BrowserMock] Failed to persist data:', err);
  }
}

export function initBrowserMockApi(): void {
  if (typeof window === 'undefined' || window.kvmApi) {
    return;
  }

  console.info('[BrowserMock] Running in web browser environment. Mocking kvmApi with localStorage.');

  const healthListeners: Set<(data: Record<string, DeviceHealth>) => void> = new Set();
  const currentHealth: Record<string, DeviceHealth> = {};

  const mockApi: KvmApi = {
    // Devices
    getDevices: async (): Promise<KvmDevice[]> => {
      return getStored<KvmDevice[]>(STORAGE_KEYS.DEVICES, []);
    },

    saveDevice: async (device: KvmDevice): Promise<KvmDevice> => {
      const devices = getStored<KvmDevice[]>(STORAGE_KEYS.DEVICES, []);
      const index = devices.findIndex((d) => d.id === device.id);
      const updated = { ...device, updatedAt: Date.now() };

      if (index >= 0) {
        devices[index] = updated;
      } else {
        devices.push(updated);
      }
      setStored(STORAGE_KEYS.DEVICES, devices);

      // Trigger simulated health check
      currentHealth[updated.id] = {
        status: 'online',
        latencyMs: 18,
        lastChecked: Date.now(),
        videoSignal: true,
      };
      healthListeners.forEach((cb) => cb({ ...currentHealth }));

      return updated;
    },

    deleteDevice: async (id: string): Promise<boolean> => {
      const devices = getStored<KvmDevice[]>(STORAGE_KEYS.DEVICES, []);
      const filtered = devices.filter((d) => d.id !== id);
      setStored(STORAGE_KEYS.DEVICES, filtered);
      delete currentHealth[id];
      healthListeners.forEach((cb) => cb({ ...currentHealth }));
      return true;
    },

    checkDeviceHealth: async (id: string): Promise<DeviceHealth> => {
      const devices = getStored<KvmDevice[]>(STORAGE_KEYS.DEVICES, []);
      const dev = devices.find((d) => d.id === id);
      if (!dev) return { status: 'unknown' };

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const startTime = Date.now();
        await fetch(`${dev.protocol}://${dev.host}:${dev.port}/?_t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          mode: 'no-cors',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;
        const health: DeviceHealth = {
          status: 'online',
          latencyMs,
          lastChecked: Date.now(),
          videoSignal: true,
        };
        currentHealth[id] = health;
        healthListeners.forEach((cb) => cb({ ...currentHealth }));
        return health;
      } catch (err: any) {
        const health: DeviceHealth = {
          status: 'offline',
          lastChecked: Date.now(),
          errorMessage: err.message || 'Offline',
        };
        currentHealth[id] = health;
        healthListeners.forEach((cb) => cb({ ...currentHealth }));
        return health;
      }
    },

    scanLan: async (): Promise<any[]> => {
      console.log('[BrowserMock] scanLan called');
      return [];
    },

    checkAllHealth: async (): Promise<Record<string, DeviceHealth>> => {
      const devices = getStored<KvmDevice[]>(STORAGE_KEYS.DEVICES, []);
      await Promise.allSettled(devices.map((d) => mockApi.checkDeviceHealth(d.id)));
      return { ...currentHealth };
    },

    // Groups
    getGroups: async (): Promise<DeviceGroup[]> => {
      return getStored<DeviceGroup[]>(STORAGE_KEYS.GROUPS, DEFAULT_GROUPS);
    },

    saveGroup: async (group: DeviceGroup): Promise<DeviceGroup> => {
      const groups = getStored<DeviceGroup[]>(STORAGE_KEYS.GROUPS, DEFAULT_GROUPS);
      const index = groups.findIndex((g) => g.id === group.id);
      if (index >= 0) {
        groups[index] = group;
      } else {
        groups.push(group);
      }
      setStored(STORAGE_KEYS.GROUPS, groups);
      return group;
    },

    deleteGroup: async (id: string): Promise<boolean> => {
      const groups = getStored<DeviceGroup[]>(STORAGE_KEYS.GROUPS, DEFAULT_GROUPS);
      const filtered = groups.filter((g) => g.id !== id);
      setStored(STORAGE_KEYS.GROUPS, filtered);
      return true;
    },

    // Health
    getHealthMap: async (): Promise<Record<string, DeviceHealth>> => {
      return { ...currentHealth };
    },

    onHealthUpdate: (callback: (data: Record<string, DeviceHealth>) => void) => {
      healthListeners.add(callback);
      callback({ ...currentHealth });
      return () => {
        healthListeners.delete(callback);
      };
    },

    // Settings
    getSettings: async (): Promise<AppSettings> => {
      return getStored<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    },

    saveSettings: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
      const current = getStored<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
      const updated = { ...current, ...settings };
      setStored(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    },

    // Backup
    exportBackup: async (): Promise<string> => {
      const data = {
        devices: getStored(STORAGE_KEYS.DEVICES, []),
        groups: getStored(STORAGE_KEYS.GROUPS, DEFAULT_GROUPS),
        settings: getStored(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS),
        timestamp: Date.now(),
      };
      return JSON.stringify(data, null, 2);
    },

    importBackup: async (json: string): Promise<{ success: boolean; importedCount: number }> => {
      try {
        const parsed = JSON.parse(json);
        if (parsed.devices && Array.isArray(parsed.devices)) {
          setStored(STORAGE_KEYS.DEVICES, parsed.devices);
          if (parsed.groups) setStored(STORAGE_KEYS.GROUPS, parsed.groups);
          if (parsed.settings) setStored(STORAGE_KEYS.SETTINGS, parsed.settings);
          return { success: true, importedCount: parsed.devices.length };
        }
        return { success: false, importedCount: 0 };
      } catch {
        return { success: false, importedCount: 0 };
      }
    },

    // Window controls
    minimizeWindow: () => {},
    maximizeWindow: () => {},
    closeWindow: () => {},
    toggleFullscreen: async (): Promise<boolean> => {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
        return true;
      } else {
        await document.exitFullscreen().catch(() => {});
        return false;
      }
    },
    isFullscreen: async (): Promise<boolean> => {
      return Boolean(document.fullscreenElement);
    },
    onFullscreenChange: (_callback: (isFull: boolean) => void) => () => {},
    openExternalUrl: (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    openPopout: async (_deviceId: string, url: string): Promise<boolean> => {
      window.open(url, '_blank', 'width=1280,height=720');
      return true;
    },

    // Actions
    getWebviewPreload: async () => '',
    preAuth: async (_device: Partial<KvmDevice>) => {
      return { success: false };
    },
    sendSpecialKey: async (_sessionId: string, key: KvmSpecialKey) => {
      console.log('[BrowserMock] Special key sent:', key);
      return { success: true };
    },
    captureScreenshot: async () => {
      return { success: true, clipboardCopied: true };
    },
    openLogs: async () => {
      console.log('[BrowserMock] openLogs called');
      return { success: true };
    },
    openDevTools: async () => {
      console.log('[BrowserMock] openDevTools called');
      return true;
    },
  };

  (mockApi as any).isMock = true;
  (window as any).kvmApi = mockApi;
}
