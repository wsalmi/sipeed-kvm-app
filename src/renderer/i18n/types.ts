import { Language } from '../../shared/types/session';

export type { Language };

export interface TranslationSchema {
  common: {
    save: string;
    cancel: string;
    close: string;
    delete: string;
    edit: string;
    confirm: string;
    status: string;
    loading: string;
  };
  titlebar: {
    brandBadge: string;
    activeCount: (online: number, total: number) => string;
    exitFullscreen: string;
    enterFullscreen: string;
    minimize: string;
    maximize: string;
    close: string;
    languageSelect: string;
  };
  header: {
    searchPlaceholder: string;
    clearSearch: string;
    layoutPicker: string;
    layoutSingle: string;
    layoutSideBySide: string;
    layoutQuad: string;
    checkNetwork: string;
    checkNetworkTooltip: string;
  };
  sidebar: {
    addKvm: string;
    quickConnect: string;
    quickConnectTooltip: string;
    networkStatus: string;
    all: string;
    online: string;
    offline: string;
    groupsAndEnvironments: string;
    gamepadReady: string;
    noGamepad: string;
    exportCatalog: string;
    importCatalog: string;
    settingsAndShortcuts: string;
  };
  devices: {
    noDevicesFound: string;
    noDevicesFiltered: string;
    addNewKvm: string;
    connect: string;
    reconnect: string;
    connecting: string;
    connected: string;
    edit: string;
    delete: string;
    confirmDelete: (name: string) => string;
    modalNewTitle: string;
    modalEditTitle: string;
    name: string;
    namePlaceholder: string;
    host: string;
    hostPlaceholder: string;
    port: string;
    protocol: string;
    hardwareModel: string;
    targetOS: string;
    group: string;
    username: string;
    password: string;
    passwordHelp: string;
    tags: string;
    tagsPlaceholder: string;
    notes: string;
    notesPlaceholder: string;
    saveDevice: string;
    quickConnectTitle: string;
    quickConnectSubtitle: string;
    connectNow: string;
  };
  session: {
    popoutWindow: string;
    closeSession: string;
    toggleSidebar: string;
    fullscreen: string;
    exitFullscreen: string;
    stretchFill: string;
    keepAspect: string;
    wakeIosMouse: string;
    wakeIosMouseTooltip: string;
    takeScreenshot: string;
    takeScreenshotTooltip: string;
    gamepadActive: (name: string) => string;
    macros: {
      ctrlAltDel: string;
      superKey: string;
      cmdSpace: string;
      altTab: string;
      cmdTab: string;
      taskManager: string;
    };
    hud: {
      title: string;
      exitHint: (shortcut: string) => string;
      kvmControls: string;
    };
    grid: {
      doubleClickToFocus: string;
    };
  };
  settings: {
    modalTitle: string;
    general: string;
    networkDiscovery: string;
    gamepadShortcuts: string;
    appearance: string;
    language: string;
    languageDesc: string;
    fullscreenShortcut: string;
    fullscreenShortcutDesc: string;
    healthCheckInterval: string;
    healthCheckIntervalDesc: (sec: number) => string;
    autoDiscovery: string;
    autoDiscoveryDesc: string;
    enableGamepad: string;
    enableGamepadDesc: string;
    gamepadDeadzone: string;
    gamepadDeadzoneDesc: (val: number) => string;
    theme: string;
    themeDark: string;
    themeMidnight: string;
    themeCyberpunk: string;
    defaultLayout: string;
    saveSettings: string;
  };
  alerts: {
    importSuccess: (count: number) => string;
    importFailed: string;
    screenshotSaved: string;
    screenshotFailed: string;
  };
}
