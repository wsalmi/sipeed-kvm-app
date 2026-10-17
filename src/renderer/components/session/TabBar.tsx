import React from 'react';
import { X, ExternalLink, Monitor, Smartphone, Apple, Terminal, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ActiveSession } from '../../../shared/types/session';
import { useI18n } from '../../i18n/I18nContext';

interface TabBarProps {
  sessions: ActiveSession[];
  activeSessionId: string | null;
  onSelectTab: (sessionId: string) => void;
  onCloseTab: (sessionId: string) => void;
  onPopoutTab: (sessionId: string) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  sessions,
  activeSessionId,
  onSelectTab,
  onCloseTab,
  onPopoutTab,
  isSidebarOpen = true,
  onToggleSidebar,
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
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;

          return (
            <div
              key={session.id}
              className={`session-tab ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(session.id)}
            >
              <span className="tab-status-dot animate-pulse-online" />
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
      </div>
    </div>
  );
};

