import React, { useState } from 'react';
import {
  Camera,
  Maximize2,
  Minimize2,
  ExternalLink,
  Gamepad2,
  MousePointer,
  Command,
  Monitor,
  Check,
  ArrowLeftRight,
} from 'lucide-react';
import { ActiveSession, KvmSpecialKey } from '../../../shared/types/session';
import { useI18n } from '../../i18n/I18nContext';

interface KvmToolbarProps {
  session: ActiveSession;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onPopout: () => void;
  fullscreenShortcut?: string;
  hasGamepad?: boolean;
  gamepadName?: string;
  isStretchFill?: boolean;
  onToggleStretchFill?: () => void;
}

export const KvmToolbar: React.FC<KvmToolbarProps> = ({
  session,
  isFullscreen,
  onToggleFullscreen,
  onPopout,
  fullscreenShortcut = 'F11',
  hasGamepad,
  gamepadName,
  isStretchFill,
  onToggleStretchFill,
}) => {
  const { t } = useI18n();
  const [screenshotSuccess, setScreenshotSuccess] = useState(false);
  const isIOS = session.device.targetOS === 'ios';
  const isMac = session.device.targetOS === 'macos';

  const sendKey = (key: KvmSpecialKey) => {
    if (window.kvmApi) {
      window.kvmApi.sendSpecialKey(session.id, key);
    }
  };

  const handleScreenshot = async () => {
    if (!window.kvmApi) return;
    try {
      const res = await window.kvmApi.captureScreenshot();
      if (res.success) {
        setScreenshotSuccess(true);
        setTimeout(() => setScreenshotSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Screenshot failed:', err);
    }
  };

  return (
    <div className="kvm-toolbar">
      {/* Target Info */}
      <div className="toolbar-section-left">
        <span className="toolbar-target-name truncate" title={session.title}>
          <Monitor size={14} className="inline mr-1" />
          {session.title}
        </span>
        <span className="toolbar-host mono">{session.device.host}</span>
      </div>

      {/* Quick OS & Hardware Macros */}
      <div className="toolbar-section-center">
        {/* iOS Special Cursor Wake-up button */}
        {isIOS && (
          <button
            className="toolbar-macro-btn btn-ios-wake"
            onClick={() => sendKey('iOSRightClickWake')}
            title={t.session.wakeIosMouseTooltip}
          >
            <MousePointer size={13} />
            <span>{t.session.wakeIosMouse}</span>
          </button>
        )}

        {/* Windows / Linux / BIOS Macros */}
        <button
          className="toolbar-macro-btn"
          onClick={() => sendKey('CtrlAltDel')}
          title={t.session.macros.ctrlAltDel}
        >
          <span className="macro-kbd">Ctrl+Alt+Del</span>
        </button>

        {isMac ? (
          <button
            className="toolbar-macro-btn"
            onClick={() => sendKey('CmdSpace')}
            title={t.session.macros.cmdSpace}
          >
            <Command size={12} />
            <span>Cmd+Space</span>
          </button>
        ) : (
          <button
            className="toolbar-macro-btn"
            onClick={() => sendKey('Super')}
            title={t.session.macros.superKey}
          >
            <span className="macro-kbd">Win ⊞</span>
          </button>
        )}

        <button
          className="toolbar-macro-btn"
          onClick={() => sendKey(isMac ? 'CmdTab' : 'AltTab')}
          title={isMac ? t.session.macros.cmdTab : t.session.macros.altTab}
        >
          <span className="macro-kbd">{isMac ? 'Cmd+Tab' : 'Alt+Tab'}</span>
        </button>

        <button
          className="toolbar-macro-btn"
          onClick={() => sendKey('CtrlShiftEsc')}
          title={t.session.macros.taskManager}
        >
          <span className="macro-kbd">TaskMgr</span>
        </button>
      </div>

      {/* Right Controls: Screenshot, Gamepad, Popout & Fullscreen */}
      <div className="toolbar-section-right">
        {/* Gamepad Status */}
        <div
          className={`toolbar-gamepad-badge ${hasGamepad ? 'active' : ''}`}
          title={hasGamepad ? t.session.gamepadActive(gamepadName || '') : t.sidebar.noGamepad}
        >
          <Gamepad2 size={14} />
          <span>{hasGamepad ? t.sidebar.gamepadReady : t.sidebar.noGamepad}</span>
        </div>

        {/* Screenshot Button */}
        <button
          className={`toolbar-icon-btn ${screenshotSuccess ? 'btn-success' : ''}`}
          onClick={handleScreenshot}
          title={t.session.takeScreenshotTooltip}
        >
          {screenshotSuccess ? <Check size={14} /> : <Camera size={14} />}
        </button>

        {/* Stretch to fill toggle */}
        {onToggleStretchFill && (
          <button
            className={`toolbar-icon-btn ${isStretchFill ? 'active text-accent-cyan' : ''}`}
            onClick={onToggleStretchFill}
            title={isStretchFill ? t.session.keepAspect : t.session.stretchFill}
          >
            <ArrowLeftRight size={14} />
          </button>
        )}

        {/* Popout Window Button */}
        <button
          className="toolbar-icon-btn"
          onClick={onPopout}
          title={t.session.popoutWindow}
        >
          <ExternalLink size={14} />
        </button>

        {/* Exclusive Fullscreen Toggle */}
        <button
          className="toolbar-icon-btn btn-fullscreen"
          onClick={onToggleFullscreen}
          title={`${t.session.fullscreen} (${fullscreenShortcut})`}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          <span className="shortcut-subtle">{fullscreenShortcut}</span>
        </button>
      </div>
    </div>
  );
};

