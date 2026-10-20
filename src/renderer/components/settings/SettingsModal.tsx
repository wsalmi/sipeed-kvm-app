import React, { useState, useEffect } from 'react';
import { Gamepad2, Maximize2, ShieldCheck, Languages, Terminal, FileText } from 'lucide-react';
import { AppSettings, LayoutMode } from '../../../shared/types/session';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useI18n } from '../../i18n/I18nContext';
import { LanguageSelector } from '../common/LanguageSelector';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Partial<AppSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const { t, language } = useI18n();
  const [fullscreenShortcut, setFullscreenShortcut] = useState('F11');
  const [healthCheckIntervalSec, setHealthCheckIntervalSec] = useState(15);
  const [enableGamepadSupport, setEnableGamepadSupport] = useState(true);
  const [gamepadDeadzone, setGamepadDeadzone] = useState(0.15);
  const [theme, setTheme] = useState<'dark' | 'midnight' | 'cyberpunk'>('dark');
  const [defaultLayout, setDefaultLayout] = useState<LayoutMode>('single');

  useEffect(() => {
    if (isOpen && window.kvmApi) {
      window.kvmApi.getSettings().then((s) => {
        if (s) {
          setFullscreenShortcut(s.fullscreenShortcut || 'F11');
          setHealthCheckIntervalSec(s.healthCheckIntervalSec || 15);
          setEnableGamepadSupport(s.enableGamepadSupport !== false);
          setGamepadDeadzone(s.gamepadDeadzone || 0.15);
          setTheme(s.theme || 'dark');
          setDefaultLayout(s.defaultLayout || 'single');
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      fullscreenShortcut: fullscreenShortcut.trim() || 'F11',
      healthCheckIntervalSec: Number(healthCheckIntervalSec) || 15,
      enableGamepadSupport,
      gamepadDeadzone: Number(gamepadDeadzone) || 0.15,
      theme,
      defaultLayout,
      language,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.settings.modalTitle}
      maxWidth="520px"
    >
      <form onSubmit={handleSubmit} className="settings-form">
        {/* Language Selection Card */}
        <div className="settings-group-card">
          <div className="group-card-header">
            <Languages size={16} className="text-accent-cyan" />
            <div>
              <h4 className="group-card-title">{t.settings.language}</h4>
              <p className="group-card-desc">{t.settings.languageDesc}</p>
            </div>
          </div>
          <div className="form-group mt-3">
            <LanguageSelector variant="segmented" />
          </div>
        </div>

        {/* Fullscreen & Game Exclusivity Section */}
        <div className="settings-group-card">
          <div className="group-card-header">
            <Maximize2 size={16} className="text-accent-cyan" />
            <div>
              <h4 className="group-card-title">{t.session.hud.title}</h4>
              <p className="group-card-desc">
                {t.settings.fullscreenShortcutDesc}
              </p>
            </div>
          </div>

          <div className="form-group mt-3">
            <label className="form-label">{t.settings.fullscreenShortcut}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={fullscreenShortcut}
                onChange={(e) => setFullscreenShortcut(e.target.value.toUpperCase())}
                placeholder="Ex: F11, ScrollLock, Pause"
                className="form-input mono"
              />
              <span className="shortcut-badge">F11</span>
            </div>
          </div>
        </div>

        {/* Gamepad / Joystick Support */}
        <div className="settings-group-card">
          <div className="group-card-header">
            <Gamepad2 size={16} className="text-accent-purple" />
            <div>
              <h4 className="group-card-title">{t.settings.enableGamepad}</h4>
              <p className="group-card-desc">
                {t.settings.enableGamepadDesc}
              </p>
            </div>
          </div>

          <div className="form-checkbox-row mt-3">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={enableGamepadSupport}
                onChange={(e) => setEnableGamepadSupport(e.target.checked)}
              />
              <span>{t.settings.enableGamepad}</span>
            </label>
          </div>

          {enableGamepadSupport && (
            <div className="form-group mt-3">
              <div className="flex justify-between items-center mb-1">
                <label className="form-label">{t.settings.gamepadDeadzone}</label>
                <span className="mono text-muted text-xs">{(gamepadDeadzone * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.35"
                step="0.05"
                value={gamepadDeadzone}
                onChange={(e) => setGamepadDeadzone(parseFloat(e.target.value))}
                className="form-range"
              />
            </div>
          )}
        </div>

        {/* Network & Health Monitoring */}
        <div className="settings-group-card">
          <div className="group-card-header">
            <ShieldCheck size={16} className="text-status-online" />
            <div>
              <h4 className="group-card-title">{t.settings.networkDiscovery}</h4>
              <p className="group-card-desc">{t.settings.healthCheckIntervalDesc(healthCheckIntervalSec)}</p>
            </div>
          </div>

          <div className="form-group mt-3">
            <label className="form-label">{t.settings.healthCheckInterval}</label>
            <select
              value={healthCheckIntervalSec}
              onChange={(e) => setHealthCheckIntervalSec(Number(e.target.value))}
              className="form-select"
            >
              <option value={10}>10s</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </div>
        </div>

        {/* Diagnostics & Logs */}
        <div className="settings-group-card">
          <div className="group-card-header">
            <Terminal size={16} className="text-accent-cyan" />
            <div>
              <h4 className="group-card-title">Diagnóstico & Depuração</h4>
              <p className="group-card-desc">Visualize registros de execução e inspecione o console de desenvolvedor (Atalho: F12 ou ⌘+⌥+I).</p>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => window.kvmApi?.openLogs()}
            >
              <FileText size={14} className="mr-1" />
              Abrir Arquivo de Logs
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => window.kvmApi?.openDevTools()}
            >
              <Terminal size={14} className="mr-1" />
              Abrir DevTools
            </Button>
          </div>
        </div>

        <div className="form-actions-row mt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="primary">
            {t.settings.saveSettings}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

