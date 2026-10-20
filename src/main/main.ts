import { app, BrowserWindow, ipcMain, shell, globalShortcut, clipboard, session, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { DeviceStore } from './services/DeviceStore';
import { HealthMonitor } from './services/HealthMonitor';
import { DeviceDiscovery } from './services/DeviceDiscovery';
import { KvmDevice } from '../shared/types/device';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Suppress noisy Chromium internal EGL/GPU driver warning logs on macOS
app.commandLine.appendSwitch('log-level', '3');
// Allow local self-signed certificates and private network requests without blocking
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('disable-features', 'BlockInsecurePrivateNetworkRequests,SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults');
app.commandLine.appendSwitch('disable-async-dns');

app.setName('Salmer KVM Studio');

// Initialize persistent file logging
const logDir = path.join(app.getPath('userData'), 'logs');
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch {}
const logFilePath = path.join(logDir, 'app.log');
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function writeLog(level: string, ...args: any[]) {
  const line = `[${new Date().toISOString()}] ${level} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;
  try {
    logStream.write(line);
    process.stdout.write(line);
  } catch {}
}

const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;

console.log = (...args) => { origLog(...args); writeLog('[INFO]', ...args); };
console.warn = (...args) => { origWarn(...args); writeLog('[WARN]', ...args); };
console.error = (...args) => { origError(...args); writeLog('[ERROR]', ...args); };

process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.salmer.kvm.studio');
}

let mainWindow: BrowserWindow | null = null;
const popoutWindows: Map<string, BrowserWindow> = new Map();
let deviceStore: DeviceStore;
let healthMonitor: HealthMonitor;
let deviceDiscovery: DeviceDiscovery;
const authTokens = new Map<string, string>();

// Allow local self-signed certificates for NanoKVM devices unconditionally
app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
  event.preventDefault();
  callback(true);
});

function createMainWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const { x, y } = primaryDisplay.workArea;

  const iconPath = path.join(__dirname, '../build/icon.png');

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: '#0c1017',
    title: 'Salmer KVM Studio',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform === 'darwin' ? false : true,
    webPreferences: {
      preload: fs.existsSync(path.join(__dirname, 'preload.cjs'))
        ? path.join(__dirname, 'preload.cjs')
        : path.join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      webSecurity: false, // Allows embedding local KVM device streams across origins
    },
  });

  win.maximize();

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.on('console-message', (_event, _level, message) => {
    console.log(`[Renderer Console] ${message}`);
  });

  win.webContents.on('before-input-event', (event, input) => {
    // F12 or Cmd+Alt+I / Ctrl+Shift+I toggles DevTools
    const isDevToolsShortcut =
      input.key === 'F12' ||
      ((input.meta || input.control) && input.alt && input.key.toLowerCase() === 'i') ||
      ((input.meta || input.control) && input.shift && input.key.toLowerCase() === 'i');

    if (input.type === 'keyDown' && isDevToolsShortcut) {
      event.preventDefault();
      win.webContents.toggleDevTools();
    }

    // Always allow ESC to exit fullscreen
    if (input.type === 'keyDown' && input.key === 'Escape' && win.isFullScreen()) {
      event.preventDefault();
      win.setFullScreen(false);
    }
  });

  win.on('enter-full-screen', () => {
    win.webContents.send('window-fullscreen-changed', true);
  });

  win.on('leave-full-screen', () => {
    win.webContents.send('window-fullscreen-changed', false);
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      console.log('[Electron Check] kvmApi available:', !!window.kvmApi, 'isMock:', window.kvmApi?.isMock);
    `);
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

function registerIpcHandlers(): void {
  // Devices
  ipcMain.handle('devices:get-all', async () => {
    return deviceStore.getDevices();
  });

  ipcMain.handle('devices:save', async (_event, device) => {
    const saved = deviceStore.saveDevice(device);
    // Check health immediately for newly added or updated device
    healthMonitor.checkDevice(saved.id).catch(() => {});
    return saved;
  });

  ipcMain.handle('devices:delete', async (_event, id) => {
    const deleted = deviceStore.deleteDevice(id);
    if (deleted) {
      healthMonitor.removeDevice(id);
    }
    return deleted;
  });

  ipcMain.handle('devices:check-health', async (_event, id) => {
    return healthMonitor.checkDevice(id);
  });

  ipcMain.handle('devices:scan-lan', async (_event, options) => {
    return deviceDiscovery.scanLan(options);
  });

  // Groups
  ipcMain.handle('groups:get-all', async () => {
    return deviceStore.getGroups();
  });

  ipcMain.handle('groups:save', async (_event, group) => {
    return deviceStore.saveGroup(group);
  });

  ipcMain.handle('groups:delete', async (_event, id) => {
    return deviceStore.deleteGroup(id);
  });

  // Health
  ipcMain.handle('health:get-map', async () => {
    return healthMonitor.getHealthMap();
  });

  ipcMain.handle('health:check-all', async () => {
    return healthMonitor.checkAllDevices();
  });

  // Settings
  ipcMain.handle('settings:get', async () => {
    return deviceStore.getSettings();
  });

  ipcMain.handle('settings:save', async (_event, settings) => {
    const updated = deviceStore.saveSettings(settings);
    updateGlobalShortcuts();
    healthMonitor.start();
    return updated;
  });

  // Backup
  ipcMain.handle('backup:export', async () => {
    return deviceStore.exportBackup();
  });

  ipcMain.handle('backup:import', async (_event, jsonString) => {
    const result = deviceStore.importBackup(jsonString);
    if (result.success) {
      healthMonitor.checkAllDevices().catch(() => {});
    }
    return result;
  });

  // Window Controls
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:toggle-fullscreen', async () => {
    if (!mainWindow) return false;
    const isFull = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(isFull);
    return isFull;
  });

  ipcMain.handle('window:is-fullscreen', async () => {
    return mainWindow ? mainWindow.isFullScreen() : false;
  });

  ipcMain.on('window:open-external', (_event, url) => {
    shell.openExternal(url);
  });

  // Popout session window (multi-monitor setup)
  ipcMain.handle('session:open-popout', async (_event, { deviceId, url }) => {
    if (popoutWindows.has(deviceId)) {
      const existing = popoutWindows.get(deviceId);
      if (existing && !existing.isDestroyed()) {
        existing.show();
        existing.focus();
        return true;
      } else {
        popoutWindows.delete(deviceId);
      }
    }

    const device = deviceStore.getDevices().find((d) => d.id === deviceId);
    const targetUrl = url || (device ? `${device.protocol}://${device.host}:${device.port}/` : '');

    if (!targetUrl) {
      console.warn('[Popout] Cannot open popout: missing target URL for device', deviceId);
      return false;
    }

    if (device && device.username && device.password) {
      try {
        await authenticateDevice(device);
      } catch (e) {
        console.warn('[Popout] Pre-auth failed:', e);
      }
    }

    const iconPath = path.join(__dirname, '../build/icon.png');
    const popout = new BrowserWindow({
      width: 1280,
      height: 720,
      backgroundColor: '#0c1017',
      title: `${device?.name || 'NanoKVM Session'} (Salmer KVM Studio)`,
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      webPreferences: {
        sandbox: false,
        contextIsolation: true,
        partition: 'persist:nanokvm',
        webSecurity: false,
      },
    });

    popout.loadURL(targetUrl).catch((err) => {
      console.error('[Popout] Failed to load URL in popout window:', err);
    });

    popout.on('closed', () => {
      popoutWindows.delete(deviceId);
    });

    popoutWindows.set(deviceId, popout);
    return true;
  });

  // Capture screenshot of current view
  ipcMain.handle('session:capture-screenshot', async () => {
    if (!mainWindow) return { success: false };
    try {
      const image = await mainWindow.capturePage();
      clipboard.writeImage(image);

      const picturesPath = app.getPath('pictures');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(picturesPath, `Sipeed-KVM-${timestamp}.png`);
      fs.writeFileSync(filePath, image.toPNG());

      return { success: true, filePath, clipboardCopied: true };
    } catch (err) {
      console.error('[Screenshot] Failed to capture page:', err);
      return { success: false };
    }
  });

  // Macro / Special Key dispatch
  ipcMain.handle('session:send-key', async (_event, { key }) => {
    console.log('[KVM Action] Special key requested:', key);
    return { success: true };
  });

  // Return absolute file URL to webview preload script
  ipcMain.handle('session:get-webview-preload', async () => {
    const preloadPath = path.join(__dirname, 'webview-preload.cjs');
    return fs.existsSync(preloadPath) ? `file://${preloadPath}` : '';
  });

  // Pre-authenticate device session
  ipcMain.handle('session:pre-auth', async (_event, device: Partial<KvmDevice>) => {
    return authenticateDevice(device);
  });

  // System & Debugging
  ipcMain.handle('system:open-logs', async () => {
    try {
      if (fs.existsSync(logFilePath)) {
        shell.showItemInFolder(logFilePath);
      } else {
        shell.openPath(logDir);
      }
      return { success: true, logFilePath };
    } catch (err: any) {
      console.error('[System] Failed to open logs:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('system:open-devtools', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
      return true;
    }
    return false;
  });
}

async function authenticateDevice(device: Partial<KvmDevice>): Promise<{ success: boolean; token?: string }> {
  let username = device.username;
  let password = device.password;
  let host = device.host;
  let protocol = device.protocol || 'https';
  let port = device.port || (protocol === 'https' ? 443 : 80);

  if ((!password || !username || !host) && (device.id || device.host)) {
    const stored = deviceStore.getDevices().find(
      (d) => (device.id && d.id === device.id) || (device.host && d.host === device.host)
    );
    if (stored) {
      username = username || stored.username;
      password = password || stored.password || (stored.id ? deviceStore.getDecryptedPassword(stored.id) : undefined);
      host = host || stored.host;
      protocol = stored.protocol || protocol;
      port = stored.port || port;
    }
  }

  if (!host || !username || !password) {
    console.warn(`[PreAuth] Incomplete credentials for host: ${host}, username: ${username}`);
    return { success: false };
  }

  // Pre-resolve .local hostname to IPv4 to prevent macOS IPv6 link-local connection timeouts
  let targetHost = host;
  if (host.toLowerCase().includes('.local')) {
    try {
      const resolved = await new Promise<string | null>((resLookup) => {
        dns.lookup(host, { family: 4 }, (err, address) => {
          if (!err && address) resLookup(address);
          else resLookup(null);
        });
      });
      if (resolved) {
        targetHost = resolved;
      }
    } catch {}
  }

  return new Promise((resolve) => {
    try {
      const isHttps = protocol === 'https';
      const httpModule = isHttps ? https : http;
      const req = httpModule.request(
        {
          hostname: targetHost,
          family: 4,
          port: port,
          path: '/api/auth/login',
          method: 'POST',
          headers: {
            'Host': host,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          rejectUnauthorized: false,
          timeout: 5000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const token = data?.data?.token;
              if (token) {
                authTokens.set(host, token);
                if (targetHost && targetHost !== host) {
                  authTokens.set(targetHost, token);
                }
                const targetUrls = Array.from(new Set([
                  `${protocol}://${host}:${port}/`,
                  `${protocol}://${host}/`,
                  `https://${host}/`,
                  `http://${host}/`,
                  `${protocol}://${targetHost}:${port}/`,
                  `${protocol}://${targetHost}/`,
                  `https://${targetHost}/`,
                  `http://${targetHost}/`,
                ]));
                const sessions = [session.defaultSession, session.fromPartition('persist:nanokvm')];
                const isSecure = protocol === 'https';

                for (const s of sessions) {
                  for (const targetUrl of targetUrls) {
                    try {
                      await s.cookies.set({
                        url: targetUrl,
                        name: 'nano-kvm-token',
                        value: token,
                        path: '/',
                        sameSite: 'lax',
                        secure: isSecure && targetUrl.startsWith('https:'),
                        expirationDate: Math.floor(Date.now() / 1000) + 30 * 86400,
                      });
                      await s.cookies.set({
                        url: targetUrl,
                        name: 'nano-kvm-auth',
                        value: '1',
                        path: '/',
                        sameSite: 'lax',
                        secure: isSecure && targetUrl.startsWith('https:'),
                        expirationDate: Math.floor(Date.now() / 1000) + 30 * 86400,
                      });
                    } catch {}
                  }
                }
                console.log(`[PreAuth] Successfully pre-authenticated device ${host}`);
                return resolve({ success: true, token });
              } else {
                console.warn(`[PreAuth] Login response rejected by ${host}:`, data?.msg || body);
              }
            } catch (err: any) {
              console.warn(`[PreAuth] Failed to parse auth response from ${host}:`, err.message);
            }
            resolve({ success: false });
          });
        }
      );

      req.on('error', (err) => {
        console.warn(`[PreAuth] Failed to authenticate with ${host}:`, err.message);
        resolve({ success: false });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false });
      });

      req.write(JSON.stringify({ username, password }));
      req.end();
    } catch {
      resolve({ success: false });
    }
  });
}

function updateGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
  const settings = deviceStore.getSettings();
  const shortcut = settings.fullscreenShortcut || 'F11';

  try {
    globalShortcut.register(shortcut, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const isFull = !mainWindow.isFullScreen();
        mainWindow.setFullScreen(isFull);
        mainWindow.webContents.send('window-fullscreen-changed', isFull);
      }
    });
  } catch (err) {
    console.warn(`[Shortcuts] Failed to register global shortcut ${shortcut}:`, err);
  }
}

const configuredSessions = new WeakSet<Electron.Session>();

function configureSession(sess: Electron.Session): void {
  if (configuredSessions.has(sess)) return;
  configuredSessions.add(sess);

  // Trust certificates unconditionally for embedded KVM streams
  sess.setCertificateVerifyProc((_request, callback) => {
    callback(0);
  });

  // Handle all permission requests (e.g. pointerLock, keyboardLock, clipboard, media)
  sess.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });
  sess.setPermissionCheckHandler((_webContents, _permission) => {
    return true;
  });

  // Attach token and cookies before sending request
  sess.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    try {
      const urlObj = new URL(details.url);
      const token = authTokens.get(urlObj.hostname);
      if (token) {
        if (!requestHeaders['Authorization']) {
          requestHeaders['Authorization'] = `Bearer ${token}`;
        }
        const existingCookie = requestHeaders['Cookie'] || '';
        const cookieMap = new Map<string, string>();
        if (existingCookie) {
          existingCookie.split(';').forEach((c) => {
            const [k, ...v] = c.trim().split('=');
            if (k) cookieMap.set(k.trim(), v.join('='));
          });
        }
        if (!cookieMap.has('nano-kvm-token')) {
          cookieMap.set('nano-kvm-token', token);
        }
        if (!cookieMap.has('nano-kvm-auth')) {
          cookieMap.set('nano-kvm-auth', '1');
        }
        requestHeaders['Cookie'] = Array.from(cookieMap.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
      }
    } catch {}
    callback({ cancel: false, requestHeaders });
  });

  // Allow embedding of NanoKVM web interfaces by removing restrictive headers and normalizing cookies
  sess.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    let hostname = '';
    try {
      hostname = new URL(details.url).hostname;
    } catch {}

    for (const key of Object.keys(responseHeaders)) {
      const lower = key.toLowerCase();
      if (
        lower === 'x-frame-options' ||
        lower === 'frame-options' ||
        lower === 'content-security-policy' ||
        lower === 'content-security-policy-report-only' ||
        lower === 'cross-origin-embedder-policy' ||
        lower === 'cross-origin-opener-policy' ||
        lower === 'cross-origin-resource-policy'
      ) {
        delete responseHeaders[key];
      }
      if (lower === 'set-cookie' && responseHeaders[key]) {
        const newCookies: string[] = [];
        let foundToken = false;

        for (const cookieStr of responseHeaders[key]) {
          const match = cookieStr.match(/nano-kvm-token=([a-zA-Z0-9_\-\.]+)/);
          if (match && match[1] && hostname) {
            authTokens.set(hostname, match[1]);
            foundToken = true;
          }

          // Clean cookie: convert SameSite to Lax and remove Secure to prevent self-signed cert drop
          const cleaned = cookieStr
            .replace(/;\s*SameSite=Strict/gi, '; SameSite=Lax')
            .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
            .replace(/;\s*Secure/gi, '');

          newCookies.push(cleaned);
        }

        // If a login returned a token, also ensure client-readable cookie nano-kvm-auth is set
        if (hostname && (foundToken || authTokens.has(hostname))) {
          newCookies.push('nano-kvm-auth=1; Path=/; Max-Age=2592000; SameSite=Lax');
        }

        responseHeaders[key] = newCookies;
      }
    }

    // Ensure CORS does not block Axios, Fetch, or WebSocket requests
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Credentials'] = ['true'];
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, DELETE, OPTIONS, HEAD'];
    responseHeaders['Access-Control-Allow-Headers'] = ['*'];

    callback({ cancel: false, responseHeaders });
  });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(__dirname, '../build/icon.png');
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
    }
  }

  configureSession(session.defaultSession);
  const nanokvmSession = session.fromPartition('persist:nanokvm');
  configureSession(nanokvmSession);

  // Handle all created webviews (ensure cert trust and header processing)
  app.on('web-contents-created', (_event, contents) => {
    contents.on('certificate-error', (event, _url, _error, _certificate, callback) => {
      event.preventDefault();
      callback(true);
    });
    contents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.key === 'Escape') {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen()) {
          mainWindow.setFullScreen(false);
        }
      }
    });
    if (contents.session) {
      configureSession(contents.session);
    }
  });

  deviceStore = new DeviceStore();
  deviceDiscovery = new DeviceDiscovery(deviceStore);
  healthMonitor = new HealthMonitor(deviceStore, deviceDiscovery);

  registerIpcHandlers();
  mainWindow = createMainWindow();
  healthMonitor.start();
  deviceDiscovery.startPeriodicDiscovery(2);
  updateGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  healthMonitor?.stop();
  deviceDiscovery?.stopPeriodicDiscovery();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
