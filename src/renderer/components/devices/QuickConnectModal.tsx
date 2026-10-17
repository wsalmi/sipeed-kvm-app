import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { KvmDevice } from '../../../shared/types/device';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useI18n } from '../../i18n/I18nContext';

interface QuickConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (device: KvmDevice) => void;
}

export const QuickConnectModal: React.FC<QuickConnectModalProps> = ({
  isOpen,
  onClose,
  onConnect,
}) => {
  const { t } = useI18n();
  const [host, setHost] = useState('');
  const [port, setPort] = useState('80');
  const [protocol, setProtocol] = useState<'http' | 'https'>('http');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  const handleHostChange = (val: string) => {
    let clean = val.trim();
    if (clean.startsWith('https://')) {
      setProtocol('https');
      clean = clean.replace('https://', '');
      if (port === '80') setPort('443');
    } else if (clean.startsWith('http://')) {
      setProtocol('http');
      clean = clean.replace('http://', '');
      if (port === '443') setPort('80');
    }

    if (clean.toLowerCase().includes('nanokvm.local') && protocol === 'http') {
      setProtocol('https');
      if (port === '80') setPort('443');
    }

    setHost(val);
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!host.trim()) return;

    let cleanHost = host.trim();
    let finalProto = protocol;
    let finalPort = Number(port) || (finalProto === 'https' ? 443 : 80);

    if (cleanHost.startsWith('https://')) {
      finalProto = 'https';
      cleanHost = cleanHost.replace('https://', '');
    } else if (cleanHost.startsWith('http://')) {
      finalProto = 'http';
      cleanHost = cleanHost.replace('http://', '');
    }

    cleanHost = cleanHost.split('/')[0];
    if (cleanHost.includes(':')) {
      const [h, p] = cleanHost.split(':');
      cleanHost = h;
      if (p) finalPort = Number(p) || finalPort;
    }

    if (cleanHost.toLowerCase().includes('nanokvm.local') && finalProto === 'http') {
      finalProto = 'https';
      if (finalPort === 80) finalPort = 443;
    }

    const tempDevice: KvmDevice = {
      id: `quick-${Date.now()}`,
      name: `Quick: ${cleanHost}`,
      host: cleanHost,
      port: finalPort,
      protocol: finalProto,
      model: 'nanokvm-go',
      targetOS: 'auto',
      username: username.trim() || undefined,
      password: password || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onConnect(tempDevice);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.devices.quickConnectTitle}
      subtitle={t.devices.quickConnectSubtitle}
      maxWidth="480px"
    >
      <form onSubmit={handleConnect} className="quick-connect-form">
        <div className="form-row">
          <div className="form-group flex-1">
            <label className="form-label">{t.devices.protocol}</label>
            <select
              value={protocol}
              onChange={(e) => {
                const proto = e.target.value as 'http' | 'https';
                setProtocol(proto);
                if (port === '80' && proto === 'https') setPort('443');
                if (port === '443' && proto === 'http') setPort('80');
              }}
              className="form-select"
            >
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
            </select>
          </div>

          <div className="form-group flex-3">
            <label className="form-label">{t.devices.host} *</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ex: 192.168.1.50 ou nanokvm.local"
              value={host}
              onChange={(e) => handleHostChange(e.target.value)}
              className="form-input mono"
            />
          </div>

          <div className="form-group flex-1">
            <label className="form-label">{t.devices.port}</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="form-input mono"
            />
          </div>
        </div>

        <div className="form-row" style={{ marginTop: '12px' }}>
          <div className="form-group flex-1">
            <label className="form-label">{t.devices.username}</label>
            <input
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input mono"
            />
          </div>
          <div className="form-group flex-1">
            <label className="form-label">{t.devices.password}</label>
            <input
              type="password"
              placeholder="admin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-actions-row">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="primary" icon={<Zap size={15} />}>
            {t.devices.connectNow}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

