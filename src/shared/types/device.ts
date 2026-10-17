export type DeviceModel =
  | 'nanokvm-go'
  | 'nanokvm-go-plus'
  | 'nanokvm-lite'
  | 'nanokvm-full'
  | 'nanokvm-usb'
  | 'generic-kvm';

export type TargetOS =
  | 'auto'
  | 'macos'
  | 'windows'
  | 'linux'
  | 'ios'
  | 'android'
  | 'bios';

export type ConnectionStatus = 'online' | 'degraded' | 'offline' | 'checking' | 'unknown';

export interface DeviceHealth {
  status: ConnectionStatus;
  latencyMs?: number;
  lastChecked?: number; // timestamp
  videoSignal?: boolean;
  resolution?: string;
  fps?: number;
  cpuTemp?: number;
  errorMessage?: string;
}

export interface KvmDevice {
  id: string;
  name: string;
  host: string; // IP, hostname, Tailscale IP/MagicDNS
  port: number; // default 80 or 443
  protocol: 'http' | 'https';
  model: DeviceModel;
  targetOS: TargetOS;
  groupId?: string;
  tags?: string[];
  notes?: string;
  username?: string;
  password?: string; // Stored securely via safeStorage
  hasStoredPassword?: boolean;
  allowInsecureCertificates?: boolean;
  createdAt: number;
  updatedAt: number;
  health?: DeviceHealth;
}

export interface DeviceGroup {
  id: string;
  name: string;
  color?: string; // hex color for badges/accents
  icon?: string;
  order: number;
}
