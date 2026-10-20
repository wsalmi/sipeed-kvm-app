import React, { useState, useEffect } from 'react';
import { KvmDevice, DeviceModel, TargetOS, DeviceGroup } from '../../../shared/types/device';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useI18n } from '../../i18n/I18nContext';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (device: Partial<KvmDevice>) => void;
  deviceToEdit?: KvmDevice | null;
  groups: DeviceGroup[];
}

export const DeviceModal: React.FC<DeviceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  deviceToEdit,
  groups,
}) => {
  const { t } = useI18n();
  const [name, setName] = useState('');

  const [host, setHost] = useState('');
  const [port, setPort] = useState('80');
  const [protocol, setProtocol] = useState<'http' | 'https'>('http');
  const [model, setModel] = useState<DeviceModel>('nanokvm-go');
  const [targetOS, setTargetOS] = useState<TargetOS>('auto');
  const [groupId, setGroupId] = useState('all');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (deviceToEdit) {
      setName(deviceToEdit.name);
      setHost(deviceToEdit.originalHost || deviceToEdit.host);
      setPort(String(deviceToEdit.port || 80));
      setProtocol(deviceToEdit.protocol || 'http');
      setModel(deviceToEdit.model || 'nanokvm-go');
      setTargetOS(deviceToEdit.targetOS || 'auto');
      setGroupId(deviceToEdit.groupId || 'all');
      setUsername(deviceToEdit.username || 'admin');
      setPassword(deviceToEdit.password || '');
      setTags(deviceToEdit.tags?.join(', ') || '');
      setNotes(deviceToEdit.notes || '');
    } else {
      setName('');
      setHost('');
      setPort('80');
      setProtocol('http');
      setModel('nanokvm-go');
      setTargetOS('auto');
      setGroupId('all');
      setUsername('admin');
      setPassword('');
      setTags('');
      setNotes('');
    }
  }, [deviceToEdit, isOpen]);

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

    const lower = clean.toLowerCase();
    if ((lower.includes('nanokvm') || lower.endsWith('.local')) && protocol === 'http') {
      setProtocol('https');
      if (port === '80') setPort('443');
    }

    setHost(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !host.trim()) return;

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

    const lowerHost = cleanHost.toLowerCase();
    if ((lowerHost.includes('nanokvm') || lowerHost.endsWith('.local')) && finalProto === 'http') {
      finalProto = 'https';
      if (finalPort === 80) finalPort = 443;
    }

    const isLocalHostname = cleanHost.includes('.local');
    const originalHost = isLocalHostname ? cleanHost : (cleanHost === deviceToEdit?.host ? deviceToEdit?.originalHost : undefined);

    onSave({
      id: deviceToEdit?.id,
      name: name.trim(),
      host: cleanHost,
      originalHost,
      resolvedIp: isLocalHostname ? deviceToEdit?.resolvedIp : cleanHost,
      port: finalPort,
      protocol: finalProto,
      model,
      targetOS,
      groupId,
      username: username.trim(),
      password: password || undefined,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      notes: notes.trim(),
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={deviceToEdit ? t.devices.modalEditTitle : t.devices.modalNewTitle}
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit} className="device-form">
        <div className="form-row">
          <div className="form-group flex-2">
            <label className="form-label">{t.devices.name} *</label>
            <input
              type="text"
              required
              placeholder={t.devices.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group flex-1">
            <label className="form-label">{t.devices.hardwareModel}</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as DeviceModel)}
              className="form-select"
            >
              <option value="nanokvm-go">NanoKVM Go</option>
              <option value="nanokvm-go-plus">NanoKVM Go+</option>
              <option value="nanokvm-usb">NanoKVM USB</option>
              <option value="nanokvm-lite">NanoKVM Lite</option>
              <option value="nanokvm-full">NanoKVM Full</option>
              <option value="generic-kvm">Generic KVM</option>
            </select>
          </div>
        </div>

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
              placeholder={t.devices.hostPlaceholder}
              value={host}
              onChange={(e) => handleHostChange(e.target.value)}
              className="form-input mono"
            />
          </div>

          <div className="form-group flex-1">
            <label className="form-label">{t.devices.port}</label>
            <input
              type="number"
              placeholder="80"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="form-input mono"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group flex-1">
            <label className="form-label">{t.devices.username}</label>
            <input
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group flex-1">
            <label className="form-label">{t.devices.password}</label>
            <input
              type="password"
              placeholder={deviceToEdit?.hasStoredPassword ? '••••••••' : t.devices.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group flex-1">
            <label className="form-label">{t.devices.targetOS}</label>
            <select
              value={targetOS}
              onChange={(e) => setTargetOS(e.target.value as TargetOS)}
              className="form-select"
            >
              <option value="auto">Auto</option>
              <option value="macos">macOS (MacBook / Mac mini)</option>
              <option value="ios">iOS / iPadOS (iPhone / iPad)</option>
              <option value="windows">Windows PC</option>
              <option value="linux">Linux / Server</option>
              <option value="bios">BIOS / UEFI / Terminal</option>
            </select>
          </div>

          <div className="form-group flex-1">
            <label className="form-label">{t.devices.group}</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="form-select"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.id === 'all' ? t.sidebar.all : g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t.devices.tags}</label>
          <input
            type="text"
            placeholder={t.devices.tagsPlaceholder}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t.devices.notes}</label>
          <textarea
            placeholder={t.devices.notesPlaceholder}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-textarea"
          />
        </div>

        <div className="form-actions-row">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="primary">
            {t.devices.saveDevice}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

