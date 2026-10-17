import React, { useState } from 'react';
import { Gamepad2, X, Minimize2, ArrowLeftRight } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

interface FullscreenHUDProps {
  isVisible: boolean;
  shortcut?: string;
  onDismiss: () => void;
  onExitFullscreen?: () => void;
  isStretchFill?: boolean;
  onToggleStretchFill?: () => void;
  hasGamepad?: boolean;
}

export const FullscreenHUD: React.FC<FullscreenHUDProps> = ({
  isVisible,
  shortcut = 'F11',
  onDismiss,
  onExitFullscreen,
  isStretchFill,
  onToggleStretchFill,
  hasGamepad,
}) => {
  const { t } = useI18n();
  const [isHovered, setIsHovered] = useState(false);
  const show = isVisible || isHovered;

  return (
    <>
      {/* Invisible hover trigger strip at the very top of the monitor */}
      <div
        className="fullscreen-top-hover-detector"
        onMouseEnter={() => setIsHovered(true)}
      />

      {/* Floating HUD pill with smooth slide down/up animation */}
      <div
        className={`fullscreen-hud-container ${show ? 'visible' : 'hidden'}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="fullscreen-hud-pill">
          <span className="hud-badge">
            {hasGamepad ? <Gamepad2 size={14} className="hud-icon animate-pulse-online" /> : '🎮'}
            <span>{t.session.hud.title}</span>
          </span>

          <span className="hud-divider">•</span>

          {onToggleStretchFill && (
            <button
              className={`hud-action-btn ${isStretchFill ? 'active' : ''}`}
              onClick={onToggleStretchFill}
              title={isStretchFill ? t.session.keepAspect : t.session.stretchFill}
            >
              <ArrowLeftRight size={13} />
              <span>{isStretchFill ? t.session.keepAspect : t.session.stretchFill}</span>
            </button>
          )}

          {onExitFullscreen && (
            <button
              className="hud-action-btn"
              onClick={onExitFullscreen}
              title={`${t.session.exitFullscreen} (${shortcut})`}
            >
              <Minimize2 size={13} />
              <span>{t.session.exitFullscreen} ({shortcut})</span>
            </button>
          )}

          <button className="hud-close-btn" onClick={onDismiss} title={t.common.close}>
            <X size={13} />
          </button>
        </div>
      </div>
    </>
  );
};

