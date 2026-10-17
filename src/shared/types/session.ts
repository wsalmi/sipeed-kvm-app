import { KvmDevice } from './device';

export type LayoutMode = 'single' | 'grid-1x2' | 'grid-2x2' | 'grid-3x3';

export interface ActiveSession {
  id: string; // unique session ID
  deviceId: string;
  device: KvmDevice;
  title: string;
  connectedAt: number;
  isFocused: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  isExclusiveLock: boolean;
  streamUrl: string;
  currentFps?: number;
}

export type KvmSpecialKey =
  | 'CtrlAltDel'
  | 'Super'
  | 'CmdSpace'
  | 'AltTab'
  | 'CmdTab'
  | 'AltF4'
  | 'CtrlShiftEsc'
  | 'Escape'
  | 'Enter'
  | 'F11'
  | 'iOSRightClickWake';

export interface GamepadState {
  connected: boolean;
  id: string;
  index: number;
  mapping: string;
  axes: number[];
  buttons: { pressed: boolean; value: number }[];
}

export type Language = 'pt' | 'en' | 'es';

export interface AppSettings {
  fullscreenShortcut: string; // Default: 'F11'
  healthCheckIntervalSec: number; // Default: 15
  autoDiscoveryMdns: boolean; // Default: true
  enableGamepadSupport: boolean; // Default: true
  gamepadDeadzone: number; // Default: 0.15
  theme: 'dark' | 'midnight' | 'cyberpunk';
  defaultLayout: LayoutMode;
  language?: Language;
}

