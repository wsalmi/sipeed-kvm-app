import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DeviceCard } from './components/devices/DeviceCard';
import { DeviceModal } from './components/devices/DeviceModal';
import { QuickConnectModal } from './components/devices/QuickConnectModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { TabBar } from './components/session/TabBar';
import { KvmToolbar } from './components/session/KvmToolbar';
import { FullscreenHUD } from './components/session/FullscreenHUD';
import { MultiViewGrid } from './components/session/MultiViewGrid';
import { useDevices } from './hooks/useDevices';
import { useSessions } from './hooks/useSessions';
import { useGamepad } from './hooks/useGamepad';
import { useFullscreenLock } from './hooks/useFullscreenLock';
import { KvmDevice } from '../shared/types/device';
import { AppSettings } from '../shared/types/session';
import { Plus, Server, Zap, Radio } from 'lucide-react';
import { Button } from './components/common/Button';
import { useI18n } from './i18n/I18nContext';

export const App: React.FC = () => {
  const { t } = useI18n();
  const {
    devices,
    filteredDevices,
    groups,
    selectedGroupId,
    setSelectedGroupId,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    saveDevice,
    deleteDevice,
    refreshDevice,
    refreshAll,
    healthMap,
    reload,
    stats,
  } = useDevices();

  const {
    sessions,
    activeSession,
    activeSessionId,
    layoutMode,
    setLayoutMode,
    connectDevice,
    closeSession,
    focusSession,
    openPopout,
  } = useSessions();

  const [settings, setSettings] = useState<AppSettings>({
    fullscreenShortcut: 'F11',
    healthCheckIntervalSec: 15,
    autoDiscoveryMdns: true,
    enableGamepadSupport: true,
    gamepadDeadzone: 0.15,
    theme: 'dark',
    defaultLayout: 'single',
  });

  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [deviceToEdit, setDeviceToEdit] = useState<KvmDevice | null>(null);
  const [isQuickConnectOpen, setIsQuickConnectOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isStretchFill, setIsStretchFill] = useState(false);

  const handleConnect = (device: KvmDevice) => {
    setIsSidebarOpen(false);
    connectDevice(device);
  };

  // Load app settings
  useEffect(() => {
    if (window.kvmApi) {
      window.kvmApi.getSettings().then((s) => {
        if (s) setSettings(s);
      }).catch(console.error);
    }
  }, []);

  // Gamepad hook
  const { hasGamepad, activeGamepad } = useGamepad({
    enabled: settings.enableGamepadSupport,
    deadzone: settings.gamepadDeadzone,
  });

  // Fullscreen lock hook
  const { isFullscreen, showHud, toggleFullscreen, dismissHud } = useFullscreenLock({
    shortcut: settings.fullscreenShortcut || 'F11',
  });

  const [isScanningLan, setIsScanningLan] = useState(false);

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true);
    await refreshAll();
    setTimeout(() => setIsRefreshingAll(false), 800);
  };

  const handleScanLan = async () => {
    if (!window.kvmApi?.scanLan) return;
    setIsScanningLan(true);
    try {
      const discovered = await window.kvmApi.scanLan({ fullSubnet: true });
      if (discovered && discovered.length > 0) {
        reload();
      }
    } catch (err) {
      console.warn('LAN scan failed:', err);
    } finally {
      setIsScanningLan(false);
    }
  };

  const handleExportBackup = async () => {
    if (!window.kvmApi) return;
    try {
      const json = await window.kvmApi.exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sipeed-kvm-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export backup:', err);
    }
  };

  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file || !window.kvmApi) return;
      const text = await file.text();
      const res = await window.kvmApi.importBackup(text);
      if (res.success) {
        alert(t.alerts.importSuccess(res.importedCount));
        reload();
      } else {
        alert(t.alerts.importFailed);
      }
    };

    input.click();
  };

  const handleSaveSettings = async (newSettings: Partial<AppSettings>) => {
    if (window.kvmApi) {
      const updated = await window.kvmApi.saveSettings(newSettings);
      setSettings(updated);
    }
  };

  // Group counts calculation
  const groupCounts: Record<string, number> = {};
  devices.forEach((d) => {
    if (d.groupId) {
      groupCounts[d.groupId] = (groupCounts[d.groupId] || 0) + 1;
    }
  });

  const hasActiveSessions = sessions.length > 0;
  const isViewingDevices = activeSessionId === null;

  return (
    <div className={`app-root theme-${settings.theme} ${isFullscreen ? 'app-fullscreen' : ''}`}>
      {/* TitleBar (hidden during exclusive fullscreen if desired, or compact) */}
      {!isFullscreen && (
        <TitleBar
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onlineCount={stats.online}
          totalCount={stats.total}
        />
      )}

      {/* Floating Fullscreen HUD notification (only active during exclusive fullscreen mode) */}
      {isFullscreen && (
        <FullscreenHUD
          isVisible={showHud}
          shortcut={settings.fullscreenShortcut || 'F11'}
          onDismiss={dismissHud}
          onExitFullscreen={toggleFullscreen}
          isStretchFill={isStretchFill}
          onToggleStretchFill={() => setIsStretchFill((prev) => !prev)}
          hasGamepad={hasGamepad}
        />
      )}

      {/* Main Workspace Layout */}
      <div className="app-workspace">
        {/* Left Navigation Sidebar (collapsible or hidden in fullscreen) */}
        {!isFullscreen && (isSidebarOpen || !hasActiveSessions || isViewingDevices) && (
          <Sidebar
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={(groupId) => {
              setSelectedGroupId(groupId);
              focusSession(null);
            }}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onOpenNewDeviceModal={() => {
              setDeviceToEdit(null);
              setIsDeviceModalOpen(true);
            }}
            onOpenQuickConnectModal={() => setIsQuickConnectOpen(true)}
            onOpenSettingsModal={() => setIsSettingsOpen(true)}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            deviceCounts={{ total: stats.total, online: stats.online, offline: stats.offline }}
            groupCounts={groupCounts}
            hasGamepad={hasGamepad}
          />
        )}

        {/* Content Area */}
        <main className="app-main-content">
          {/* Active Sessions Tab Bar (rendered whenever sessions exist) */}
          {hasActiveSessions && !isFullscreen && (
            <TabBar
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectTab={focusSession}
              onCloseTab={closeSession}
              onPopoutTab={openPopout}
              onSelectDevices={() => focusSession(null)}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              healthMap={healthMap}
            />
          )}

          {isViewingDevices ? (
            <>
              {/* Top Header Bar (catalog search & filter) */}
              {!isFullscreen && (
                <Header
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  layoutMode={layoutMode}
                  onLayoutChange={setLayoutMode}
                  onRefreshAll={handleRefreshAll}
                  isRefreshing={isRefreshingAll}
                  hasActiveSessions={hasActiveSessions}
                  activeSessionCount={sessions.length}
                />
              )}

              {/* Dashboard / Device Catalog Grid */}
              <div className="devices-dashboard-container">
                <div className="dashboard-intro-row">
                  <div>
                    <h2 className="dashboard-title">
                      {selectedGroupId === 'all'
                        ? t.sidebar.all
                        : groups.find((g) => g.id === selectedGroupId)?.name || t.sidebar.all}
                    </h2>
                    <p className="dashboard-subtitle">
                      {filteredDevices.length} • {t.titlebar.activeCount(stats.online, stats.total)}
                    </p>
                  </div>

                  <div className="dashboard-quick-actions flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Radio size={14} className={isScanningLan ? 'animate-pulse text-accent-cyan' : ''} />}
                      onClick={handleScanLan}
                      disabled={isScanningLan}
                      title="Procurar novos NanoKVMs ativos na rede local via mDNS e varredura de sub-rede"
                    >
                      {isScanningLan ? 'Escaneando...' : 'Escanear Rede'}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Plus size={14} />}
                      onClick={() => {
                        setDeviceToEdit(null);
                        setIsDeviceModalOpen(true);
                      }}
                    >
                      {t.sidebar.addKvm}
                    </Button>
                  </div>
                </div>

                {filteredDevices.length === 0 ? (
                  <div className="empty-state-card animate-fade-in">
                    <Server size={48} className="empty-state-icon" />
                    <h3>{searchQuery ? t.devices.noDevicesFiltered : t.devices.noDevicesFound}</h3>
                    <div className="empty-state-buttons">
                      <Button
                        variant="primary"
                        icon={<Plus size={15} />}
                        onClick={() => {
                          setDeviceToEdit(null);
                          setIsDeviceModalOpen(true);
                        }}
                      >
                        {t.devices.addNewKvm}
                      </Button>
                      <Button
                        variant="secondary"
                        icon={<Zap size={15} />}
                        onClick={() => setIsQuickConnectOpen(true)}
                      >
                        {t.sidebar.quickConnect}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="devices-cards-grid animate-fade-in">
                    {filteredDevices.map((device) => {
                      const isConnected = sessions.some((s) => s.deviceId === device.id);
                      return (
                        <DeviceCard
                          key={device.id}
                          device={device}
                          isConnected={isConnected}
                          onConnect={handleConnect}
                          onEdit={(d) => {
                            setDeviceToEdit(d);
                            setIsDeviceModalOpen(true);
                          }}
                          onDelete={deleteDevice}
                          onRefresh={refreshDevice}
                          onPopout={(d) => openPopout(d)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Active Sessions KVM View */
            <div className="active-sessions-wrapper">
              {activeSession && !isFullscreen && (
                <KvmToolbar
                  session={activeSession}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={toggleFullscreen}
                  onPopout={() => openPopout(activeSession.id)}
                  fullscreenShortcut={settings.fullscreenShortcut || 'F11'}
                  hasGamepad={hasGamepad}
                  gamepadName={activeGamepad?.id}
                  isStretchFill={isStretchFill}
                  onToggleStretchFill={() => setIsStretchFill((prev) => !prev)}
                />
              )}

              <div className="sessions-viewport-area">
                <MultiViewGrid
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  layoutMode={layoutMode}
                  onFocusSession={focusSession}
                  onCloseSession={closeSession}
                  isStretchFill={isStretchFill}
                  onSingleView={(sessId) => {
                    focusSession(sessId);
                    setLayoutMode('single');
                  }}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <DeviceModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        onSave={saveDevice}
        deviceToEdit={deviceToEdit}
        groups={groups}
      />

      <QuickConnectModal
        isOpen={isQuickConnectOpen}
        onClose={() => setIsQuickConnectOpen(false)}
        onConnect={handleConnect}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
};
