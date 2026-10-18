import React from 'react';
import { X, ExternalLink, Monitor, Smartphone, Apple, Terminal, PanelLeftClose, PanelLeftOpen, LayoutGrid, Plus } from 'lucide-react';
import { ActiveSession } from '../../../shared/types/session';
import { DeviceHealth } from '../../../shared/types/device';
import { useI18n } from '../../i18n/I18nContext';

interface TabBarProps {
  sessions: ActiveSession[];
  activeSessionId: string | null;
  onSelectTab: (sessionId: string) => void;
  onCloseTab: (sessionId: string) => void;
  onPopoutTab: (sessionId: string) => void;
  onSelectDevices?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  healthMap?: Record<string, DeviceHealth>;
}

export const TabBar: React.FC<TabBarProps> = ({
  sessions,
  activeSessionId,
  onSelectTab,
  onCloseTab,
  onPopoutTab,
  onSelectDevices,
  isSidebarOpen = true,
  onToggleSidebar,
  healthMap,
}) => {
  const { t } = useI18n();
  if (sessions.length === 0) return null;

  const getOsIcon = (targetOS: string) => {
    switch (targetOS) {
      case 'macos':
        return <Apple size={13} />;
      case 'ios':
        return <Smartphone size={13} />;
      case 'linux':
        return <Terminal size={13} />;
      default:
        return <Monitor size={13} />;
    }
  };

  const isDevicesActive = activeSessionId === null;

  return (
    <div className="session-tab-bar">
      {onToggleSidebar && (
        <button
          className="tab-sidebar-toggle-btn"
          onClick={onToggleSidebar}
          title={t.session.toggleSidebar}
        >
          {isSidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          <span className="toggle-label">{t.session.toggleSidebar}</span>
        </button>
      )}

      <div className="tabs-list">
        {/* Dispositivos Tab (Takes user back to the catalog / device listing) */}
        {onSelectDevices && (
          <div
            className={`session-tab devices-catalog-tab ${isDevicesActive ? 'active' : ''}`}
            onClick={onSelectDevices}
            title={t.session.devicesTab}
          >
            <LayoutGrid size={13} className="tab-catalog-icon" />
            <span className="tab-title">{t.session.devicesTab}</span>
          </div>
        )}

        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const health = healthMap?.[session.deviceId];
          const status = health?.status || 'checking';

          let dotClass = 'tab-status-offline';
          if (status === 'online') {
            dotClass = 'tab-status-online animate-pulse-online';
          } else if (status === 'degraded') {
            dotClass = 'tab-status-degraded animate-pulse-degraded';
          } else if (status === 'checking') {
            dotClass = 'tab-status-checking animate-spin-slow';
          }

          return (
            <div
              key={session.id}
              className={`session-tab ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(session.id)}
            >
              <span className={`tab-status-dot ${dotClass}`} />
              <span className="tab-os-icon">{getOsIcon(session.device.targetOS)}</span>
              <span className="tab-title truncate" title={session.title}>
                {session.title}
              </span>

              <div className="tab-actions-hover">
                <button
                  className="tab-tool-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPopoutTab(session.id);
                  }}
                  title={t.session.popoutWindow}
                >
                  <ExternalLink size={12} />
                </button>
                <button
                  className="tab-tool-btn tab-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(session.id);
                  }}
                  title={t.session.closeSession}
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          );
        })}

        {/* Add Connection / Browse Devices button */}
        {onSelectDevices && (
          <button
            className="tab-add-btn"
            onClick={onSelectDevices}
            title={t.session.newConnection}
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

