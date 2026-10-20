import React from 'react';
import {
  ExternalLink,
  Play,
  Settings2,
  Trash2,
  RefreshCw,
  Smartphone,
  Apple,
  Monitor,
  Terminal,
  Cpu,
} from 'lucide-react';
import { KvmDevice } from '../../../shared/types/device';
import { Badge } from '../common/Badge';
import { useI18n } from '../../i18n/I18nContext';

interface DeviceCardProps {
  device: KvmDevice;
  onConnect: (device: KvmDevice) => void;
  onEdit: (device: KvmDevice) => void;
  onDelete: (id: string) => void;
  onRefresh: (id: string) => void;
  onPopout: (device: KvmDevice) => void;
  isConnected?: boolean;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onConnect,
  onEdit,
  onDelete,
  onRefresh,
  onPopout,
  isConnected,
}) => {
  const { t } = useI18n();
  const isChecking = device.health?.status === 'checking';

  const getOsIcon = () => {
    switch (device.targetOS) {
      case 'macos':
        return <span title="macOS"><Apple size={14} /></span>;
      case 'ios':
        return <span title="iOS / iPadOS"><Smartphone size={14} /></span>;
      case 'windows':
        return <span title="Windows"><Monitor size={14} /></span>;
      case 'linux':
        return <span title="Linux"><Terminal size={14} /></span>;
      default:
        return <span title="BIOS / Generic"><Cpu size={14} /></span>;
    }
  };

  const getModelLabel = () => {
    switch (device.model) {
      case 'nanokvm-go':
        return 'NanoKVM Go';
      case 'nanokvm-go-plus':
        return 'NanoKVM Go+';
      case 'nanokvm-usb':
        return 'NanoKVM USB';
      case 'nanokvm-full':
        return 'NanoKVM Full';
      case 'nanokvm-lite':
        return 'NanoKVM Lite';
      default:
        return 'Sipeed KVM';
    }
  };

  return (
    <div className={`device-card ${isConnected ? 'device-connected' : ''}`}>
      {/* Top Header */}
      <div className="card-header">
        <div className="card-title-row">
          <span className="os-icon-badge">{getOsIcon()}</span>
          <div className="title-text-group">
            <h4 className="device-name truncate" title={device.name}>
              {device.name}
            </h4>
            <span className="device-model-label">{getModelLabel()}</span>
          </div>
        </div>

        <Badge
          status={device.health?.status}
          latencyMs={device.health?.latencyMs}
        />
      </div>

      {/* Network & Host Information */}
      <div className="card-network-info">
        <span
          className="host-address mono truncate"
          title={`${device.protocol}://${device.originalHost || device.host}:${device.port}${device.resolvedIp && device.resolvedIp !== (device.originalHost || device.host) ? ` (${device.resolvedIp})` : ''}`}
        >
          {device.originalHost || device.host}:{device.port}
          {device.resolvedIp && device.resolvedIp !== (device.originalHost || device.host) && (
            <span style={{ opacity: 0.65, fontSize: '0.85em', marginLeft: 4 }}>
              ({device.resolvedIp})
            </span>
          )}
        </span>
        {device.tags && device.tags.length > 0 && (
          <div className="card-tags-list">
            {device.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="card-tag truncate">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Action Row */}
      <div className="card-actions">
        <button
          className="btn-connect-primary"
          onClick={() => onConnect(device)}
          title={isConnected ? t.devices.connected : t.devices.connect}
        >
          <Play size={13} fill="currentColor" />
          <span>{isConnected ? t.devices.connected : t.devices.connect}</span>
        </button>

        <div className="card-secondary-btns">
          <button
            className="action-icon-btn"
            onClick={() => onPopout(device)}
            title={t.session.popoutWindow}
          >
            <ExternalLink size={13} />
          </button>
          <button
            className="action-icon-btn"
            onClick={() => onRefresh(device.id)}
            disabled={isChecking}
            title={t.header.checkNetwork}
          >
            <RefreshCw size={13} className={isChecking ? 'animate-spin-slow' : ''} />
          </button>
          <button
            className="action-icon-btn"
            onClick={() => onEdit(device)}
            title={t.devices.edit}
          >
            <Settings2 size={13} />
          </button>
          <button
            className="action-icon-btn btn-delete"
            onClick={() => onDelete(device.id)}
            title={t.devices.delete}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
