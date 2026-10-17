import React from 'react';
import {
  Server,
  Plus,
  Zap,
  Folder,
  Radio,
  Settings,
  Gamepad2,
  HardDriveDownload,
  HardDriveUpload,
  Layers,
} from 'lucide-react';
import { DeviceGroup } from '../../../shared/types/device';
import { Button } from '../common/Button';
import { useI18n } from '../../i18n/I18nContext';

interface SidebarProps {
  groups: DeviceGroup[];
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  statusFilter: 'all' | 'online' | 'offline';
  onStatusFilterChange: (status: 'all' | 'online' | 'offline') => void;
  onOpenNewDeviceModal: () => void;
  onOpenQuickConnectModal: () => void;
  onOpenSettingsModal: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  deviceCounts: { total: number; online: number; offline: number };
  groupCounts: Record<string, number>;
  hasGamepad?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  groups,
  selectedGroupId,
  onSelectGroup,
  statusFilter,
  onStatusFilterChange,
  onOpenNewDeviceModal,
  onOpenQuickConnectModal,
  onOpenSettingsModal,
  onExportBackup,
  onImportBackup,
  deviceCounts,
  groupCounts,
  hasGamepad,
}) => {
  const { t } = useI18n();

  return (
    <aside className="app-sidebar">
      {/* Primary Actions */}
      <div className="sidebar-actions">
        <Button
          variant="primary"
          size="md"
          icon={<Plus size={16} />}
          onClick={onOpenNewDeviceModal}
          className="w-full"
        >
          {t.sidebar.addKvm}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Zap size={14} />}
          onClick={onOpenQuickConnectModal}
          className="w-full"
          title={t.sidebar.quickConnectTooltip}
        >
          {t.sidebar.quickConnect}
        </Button>
      </div>

      {/* Navigation Sections */}
      <div className="sidebar-scrollable">
        {/* Status Filter Section */}
        <div className="sidebar-section">
          <div className="section-title">
            <Radio size={12} />
            <span>{t.sidebar.networkStatus}</span>
          </div>
          <div className="status-filter-pills">
            <button
              className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => onStatusFilterChange('all')}
            >
              <span>{t.sidebar.all}</span>
              <span className="pill-count">{deviceCounts.total}</span>
            </button>
            <button
              className={`filter-pill pill-online ${statusFilter === 'online' ? 'active' : ''}`}
              onClick={() => onStatusFilterChange('online')}
            >
              <span className="pill-dot" />
              <span>{t.sidebar.online}</span>
              <span className="pill-count">{deviceCounts.online}</span>
            </button>
            <button
              className={`filter-pill pill-offline ${statusFilter === 'offline' ? 'active' : ''}`}
              onClick={() => onStatusFilterChange('offline')}
            >
              <span className="pill-dot" />
              <span>{t.sidebar.offline}</span>
              <span className="pill-count">{deviceCounts.offline}</span>
            </button>
          </div>
        </div>

        {/* Groups / Environments Section */}
        <div className="sidebar-section">
          <div className="section-title">
            <Layers size={12} />
            <span>{t.sidebar.groupsAndEnvironments}</span>
          </div>
          <nav className="groups-nav">
            {groups.map((group) => {
              const count = group.id === 'all' ? deviceCounts.total : groupCounts[group.id] || 0;
              const isSelected = selectedGroupId === group.id;

              return (
                <button
                  key={group.id}
                  className={`group-nav-item ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectGroup(group.id)}
                >
                  <span className="group-icon" style={{ color: group.color || 'var(--accent-cyan)' }}>
                    {group.id === 'all' ? <Server size={14} /> : <Folder size={14} />}
                  </span>
                  <span className="group-name truncate">{group.id === 'all' ? t.sidebar.all : group.name}</span>
                  <span className="group-count">{count}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        {/* Gamepad Status Indicator */}
        <div className={`gamepad-status-indicator ${hasGamepad ? 'active' : ''}`}>
          <Gamepad2 size={15} />
          <span>{hasGamepad ? t.sidebar.gamepadReady : t.sidebar.noGamepad}</span>
        </div>

        <div className="footer-action-row">
          <button className="footer-tool-btn" onClick={onExportBackup} title={t.sidebar.exportCatalog}>
            <HardDriveDownload size={14} />
          </button>
          <button className="footer-tool-btn" onClick={onImportBackup} title={t.sidebar.importCatalog}>
            <HardDriveUpload size={14} />
          </button>
          <button className="footer-tool-btn" onClick={onOpenSettingsModal} title={t.sidebar.settingsAndShortcuts}>
            <Settings size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
};

