import { contextBridge, ipcRenderer } from 'electron';
import { KvmDevice, DeviceGroup, DeviceHealth } from '../shared/types/device';
import { AppSettings, KvmSpecialKey } from '../shared/types/session';

export const kvmApi = {
  // Devices
  getDevices: (): Promise<KvmDevice[]> => ipcRenderer.invoke('devices:get-all'),
  saveDevice: (device: KvmDevice): Promise<KvmDevice> => ipcRenderer.invoke('devices:save', device),
  deleteDevice: (id: string): Promise<boolean> => ipcRenderer.invoke('devices:delete', id),
  checkDeviceHealth: (id: string): Promise<DeviceHealth> => ipcRenderer.invoke('devices:check-health', id),
  scanLan: (options?: { fullSubnet?: boolean }): Promise<any[]> =>
    ipcRenderer.invoke('devices:scan-lan', options),

  // Groups
  getGroups: (): Promise<DeviceGroup[]> => ipcRenderer.invoke('groups:get-all'),
  saveGroup: (group: DeviceGroup): Promise<DeviceGroup> => ipcRenderer.invoke('groups:save', group),
  deleteGroup: (id: string): Promise<boolean> => ipcRenderer.invoke('groups:delete', id),

  // Health Monitoring
  getHealthMap: (): Promise<Record<string, DeviceHealth>> => ipcRenderer.invoke('health:get-map'),
  checkAllHealth: (): Promise<Record<string, DeviceHealth>> => ipcRenderer.invoke('health:check-all'),
  onHealthUpdate: (callback: (data: Record<string, DeviceHealth>) => void): (() => void) => {
    const handler = (_event: any, data: Record<string, DeviceHealth>) => callback(data);
    ipcRenderer.on('device-health-update', handler);
    return () => {
      ipcRenderer.removeListener('device-health-update', handler);
    };
  },

  // Settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:save', settings),

  // Backup
  exportBackup: (): Promise<string> => ipcRenderer.invoke('backup:export'),
  importBackup: (json: string): Promise<{ success: boolean; importedCount: number }> =>
    ipcRenderer.invoke('backup:import', json),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  toggleFullscreen: (): Promise<boolean> => ipcRenderer.invoke('window:toggle-fullscreen'),
  isFullscreen: (): Promise<boolean> => ipcRenderer.invoke('window:is-fullscreen'),
  onFullscreenChange: (callback: (isFull: boolean) => void): (() => void) => {
    const handler = (_event: any, isFull: boolean) => callback(isFull);
    ipcRenderer.on('window-fullscreen-changed', handler);
    return () => {
      ipcRenderer.removeListener('window-fullscreen-changed', handler);
    };
  },
  openExternalUrl: (url: string) => ipcRenderer.send('window:open-external', url),
  openPopout: (deviceId: string, url: string) => ipcRenderer.invoke('session:open-popout', { deviceId, url }),

  // KVM Actions & Input
  getWebviewPreload: (): Promise<string> => ipcRenderer.invoke('session:get-webview-preload'),
  preAuth: (device: Partial<KvmDevice>): Promise<{ success: boolean; token?: string }> =>
    ipcRenderer.invoke('session:pre-auth', device),
  sendSpecialKey: (sessionId: string, key: KvmSpecialKey) => ipcRenderer.invoke('session:send-key', { sessionId, key }),
  captureScreenshot: (): Promise<{ success: boolean; filePath?: string; clipboardCopied?: boolean }> =>
    ipcRenderer.invoke('session:capture-screenshot'),

  // Diagnostics & Logs
  openLogs: (): Promise<{ success: boolean; logFilePath?: string; error?: string }> =>
    ipcRenderer.invoke('system:open-logs'),
  openDevTools: (): Promise<boolean> =>
    ipcRenderer.invoke('system:open-devtools'),
};

contextBridge.exposeInMainWorld('kvmApi', kvmApi);

export type KvmApi = typeof kvmApi;
