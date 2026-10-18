import React from 'react';
import { Maximize2, Minimize2, Minus, Square, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { LanguageSelector } from '../common/LanguageSelector';

interface TitleBarProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onlineCount?: number;
  totalCount?: number;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  isFullscreen,
  onToggleFullscreen,
  onlineCount = 0,
  totalCount = 0,
}) => {
  const { t } = useI18n();
  const isMac = navigator.userAgent.includes('Mac');

  const handleMinimize = () => window.kvmApi?.minimizeWindow();
  const handleMaximize = () => window.kvmApi?.maximizeWindow();
  const handleClose = () => window.kvmApi?.closeWindow();

  return (
    <header className="app-titlebar titlebar-drag">
      <div className="titlebar-left titlebar-no-drag">
        {isMac && <div className="mac-traffic-lights-spacer" />}
        <div className="app-brand">
          <img src="/icon.png" alt="Salmer KVM Studio" className="brand-logo-img" />
          <span className="brand-title">Salmer KVM Studio</span>
          <span className="brand-badge">{t.titlebar.brandBadge}</span>
        </div>
      </div>

      <div className="titlebar-center">
        {totalCount > 0 && (
          <div className="titlebar-status-pill">
            <span
              className={`pill-dot ${
                onlineCount > 0 ? 'pill-dot-online animate-pulse-online' : 'pill-dot-offline'
              }`}
            />
            <span>{t.titlebar.activeCount(onlineCount, totalCount)}</span>
          </div>
        )}
      </div>

      <div className="titlebar-right titlebar-no-drag">
        {/* Language Selector (Top Right) */}
        <LanguageSelector />

        <button
          className="titlebar-action-btn"
          onClick={onToggleFullscreen}
          title={isFullscreen ? t.titlebar.exitFullscreen : t.titlebar.enterFullscreen}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          <span className="shortcut-hint">F11</span>
        </button>

        {!isMac && (
          <div className="win-window-controls">
            <button className="win-btn" onClick={handleMinimize} title={t.titlebar.minimize}>
              <Minus size={13} />
            </button>
            <button className="win-btn" onClick={handleMaximize} title={t.titlebar.maximize}>
              <Square size={11} />
            </button>
            <button className="win-btn win-btn-close" onClick={handleClose} title={t.titlebar.close}>
              <X size={13} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

