import React from 'react';
import { ConnectionStatus } from '../../../shared/types/device';

interface BadgeProps {
  status?: ConnectionStatus;
  latencyMs?: number;
  label?: string;
  variant?: 'status' | 'tag' | 'count';
  color?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  latencyMs,
  label,
  variant = 'status',
  color,
}) => {
  if (variant === 'status' && status) {
    const isOnline = status === 'online';
    const isDegraded = status === 'degraded';
    const isOffline = status === 'offline';
    const isChecking = status === 'checking';

    let dotClass = 'bg-gray-400';
    let text = 'Desconhecido';
    let styleClass = 'badge-unknown';

    if (isOnline) {
      dotClass = 'animate-pulse-online';
      text = latencyMs !== undefined ? `${latencyMs}ms` : 'Online';
      styleClass = 'badge-online';
    } else if (isDegraded) {
      dotClass = 'animate-pulse-degraded';
      text = latencyMs !== undefined ? `${latencyMs}ms (Aviso)` : 'Degradado';
      styleClass = 'badge-degraded';
    } else if (isOffline) {
      text = 'Offline';
      styleClass = 'badge-offline';
    } else if (isChecking) {
      dotClass = 'animate-spin-slow';
      text = 'Checando...';
      styleClass = 'badge-checking';
    }

    return (
      <span className={`status-badge ${styleClass}`}>
        <span className={`status-dot ${dotClass}`} />
        <span>{label || text}</span>
      </span>
    );
  }

  if (variant === 'count') {
    return (
      <span className="count-badge">
        {label}
      </span>
    );
  }

  return (
    <span
      className="tag-badge"
      style={color ? { borderColor: `${color}40`, backgroundColor: `${color}15`, color } : undefined}
    >
      {label}
    </span>
  );
};
