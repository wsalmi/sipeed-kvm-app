import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, WifiOff, ExternalLink } from 'lucide-react';
import { ActiveSession } from '../../../shared/types/session';

interface KvmSessionViewProps {
  session: ActiveSession;
  isFocused?: boolean;
  isStretchFill?: boolean;
}

export const KvmSessionView: React.FC<KvmSessionViewProps> = ({
  session,
  isFocused = true,
  isStretchFill = false,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [webviewPreload, setWebviewPreload] = useState<string | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<any>(null);
  const isDomReadyRef = useRef<boolean>(false);
  const isPointerLockedRef = useRef<boolean>(false);
  const isElectron = typeof window !== 'undefined' && Boolean((window as any).kvmApi) && !(window as any).kvmApi?.isMock;
  const [deviceCreds, setDeviceCreds] = useState<{ username?: string; password?: string }>({
    username: session.device.username,
    password: session.device.password,
  });

  // Fetch webview preload script URL in Electron
  useEffect(() => {
    if (isElectron && (window as any).kvmApi?.getWebviewPreload) {
      (window as any).kvmApi.getWebviewPreload().then((preloadUrl: string) => {
        if (preloadUrl) {
          setWebviewPreload(preloadUrl);
        }
      }).catch(() => {});
    }
  }, [isElectron]);

  // Resolve device credentials from store if password was omitted in the in-memory object
  useEffect(() => {
    if (session.device.username && session.device.password) {
      setDeviceCreds({ username: session.device.username, password: session.device.password });
    } else if (isElectron && window.kvmApi?.getDevices) {
      window.kvmApi.getDevices().then((devices) => {
        const found = devices.find((d) => d.id === session.device.id || d.host === session.device.host);
        if (found) {
          setDeviceCreds({
            username: found.username || session.device.username,
            password: found.password || session.device.password,
          });
        }
      }).catch(() => {});
    }
  }, [session.device.id, session.device.host, session.device.username, session.device.password, isElectron]);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    isDomReadyRef.current = false;

    // Perform pre-authentication in background and set cookies
    if (isElectron && window.kvmApi?.preAuth) {
      window.kvmApi.preAuth(session.device).then((res) => {
        if (res.success && webviewRef.current) {
          try {
            console.log('[KVM View] Pre-auth succeeded for:', session.streamUrl);
          } catch {}
        }
      }).catch(() => {});
    }

    // Timeout fallback if device does not load in 5s
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [session.streamUrl, session.device, isElectron]);

  useEffect(() => {
    const el = webviewRef.current;
    if (!el || !isElectron) return;

    const onFinish = () => {
      isDomReadyRef.current = true;
      setIsLoading(false);
      setHasError(false);

      if (typeof el.executeJavaScript === 'function') {
        const targetUser = deviceCreds.username || session.device.username || '';
        const targetPass = deviceCreds.password || session.device.password || '';

        const injectScript = `
          (function() {
            try {
              // 1. Pointer Lock Safety Polyfill
              // In Chromium GuestView (<webview>), calling native requestPointerLock() hits
              // NOTREACHED() in check.cc and crashes Electron. This polyfill catches it and delegates.
              if (!window._sipeedPointerLockPatched) {
                window._sipeedPointerLockPatched = true;
                let isLocked = false;
                let currentTarget = null;

                const safeLock = function() {
                  currentTarget = this;
                  isLocked = true;
                  console.log('__SIPEED_POINTER_LOCK_REQUEST__');
                  setTimeout(() => {
                    try {
                      document.dispatchEvent(new Event('pointerlockchange', { bubbles: true }));
                    } catch(e) {}
                  }, 10);
                  return Promise.resolve();
                };

                const safeExit = function() {
                  if (isLocked) {
                    isLocked = false;
                    currentTarget = null;
                    console.log('__SIPEED_POINTER_LOCK_EXIT__');
                    setTimeout(() => {
                      try {
                        document.dispatchEvent(new Event('pointerlockchange', { bubbles: true }));
                      } catch(e) {}
                    }, 10);
                  }
                };

                if (typeof Element !== 'undefined' && Element.prototype) {
                  Element.prototype.requestPointerLock = safeLock;
                }
                if (typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype) {
                  HTMLCanvasElement.prototype.requestPointerLock = safeLock;
                }
                if (typeof document !== 'undefined') {
                  document.exitPointerLock = safeExit;
                  try {
                    Object.defineProperty(document, 'pointerLockElement', {
                      get() { return isLocked ? currentTarget : null; },
                      configurable: true
                    });
                  } catch(e) {}
                }

                window.addEventListener('message', (ev) => {
                  if (ev.data?.type === 'SIPEED_FORCE_UNLOCK_POINTER') {
                    safeExit();
                  } else if (ev.data?.type === 'SIPEED_MOUSE_MOVE_DELTA' && isLocked && currentTarget) {
                    try {
                      currentTarget.dispatchEvent(new MouseEvent('mousemove', {
                        bubbles: true,
                        cancelable: true,
                        clientX: ev.data.clientX || 0,
                        clientY: ev.data.clientY || 0,
                        movementX: ev.data.movementX || 0,
                        movementY: ev.data.movementY || 0,
                      }));
                    } catch(e) {}
                  }
                });
              }

              // 2. Ensure nano-kvm-auth cookie is set for client router checks
              if (document.cookie.includes('nano-kvm-token=')) {
                document.cookie = "nano-kvm-auth=1; path=/; max-age=2592000; SameSite=Lax";
              }

              // 3. If already authenticated but React Router redirected to /auth/login, redirect back to /
              const isAuthRoute = window.location.pathname.includes('/auth');
              const hasAuthCookie = document.cookie.includes('nano-kvm-auth') || document.cookie.includes('nano-kvm-token');
              if (isAuthRoute && hasAuthCookie) {
                window.location.replace('/');
                return;
              }

              // 4. React/Ant Design SPA Auto-fill and Auto-submit
              const targetUser = ${JSON.stringify(targetUser)};
              const targetPass = ${JSON.stringify(targetPass)};

              if (targetUser && targetPass && !window._sipeedAutoLoginRunning) {
                window._sipeedAutoLoginRunning = true;
                let attempts = 0;
                const maxAttempts = 25; // 25 * 200ms = 5 seconds

                const setReactVal = (elem, val) => {
                  const proto = Object.getPrototypeOf(elem);
                  const desc = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
                  if (desc && desc.set) {
                    desc.set.call(elem, val);
                  } else {
                    elem.value = val;
                  }
                  elem.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                  elem.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                };

                const pollTimer = setInterval(() => {
                  attempts++;
                  if (attempts > maxAttempts) {
                    clearInterval(pollTimer);
                    window._sipeedAutoLoginRunning = false;
                    return;
                  }

                  if (!window.location.pathname.includes('/auth') || document.cookie.includes('nano-kvm-auth')) {
                    clearInterval(pollTimer);
                    window._sipeedAutoLoginRunning = false;
                    return;
                  }

                  const u = document.querySelector('input#username, input[placeholder*="user" i], input[type="text"]');
                  const p = document.querySelector('input#password, input[type="password"]');
                  const btn = document.querySelector('button[type="submit"], form button.ant-btn-primary');

                  if (u && p && btn) {
                    if (!p.value || p.value !== targetPass) {
                      setReactVal(u, targetUser);
                      setReactVal(p, targetPass);
                      setTimeout(() => {
                        if (btn && !btn.disabled) {
                          btn.click();
                        }
                      }, 120);
                    }
                    clearInterval(pollTimer);
                    window._sipeedAutoLoginRunning = false;
                  }
                }, 200);
              }

              // 5. Inject style to ensure webview document fills 100% of container
              const styleId = 'sipeed-full-area-style';
              let style = document.getElementById(styleId);
              if (!style) {
                style = document.createElement('style');
                style.id = styleId;
                document.head.appendChild(style);
              }
              style.textContent = ${JSON.stringify(`
                html, body, [id="root"] {
                  width: 100% !important;
                  height: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow: hidden !important;
                  background: #000 !important;
                }
                body.sipeed-stretch-mode [id="screen"],
                body.sipeed-stretch-mode canvas,
                body.sipeed-stretch-mode video {
                  width: 100vw !important;
                  height: 100vh !important;
                  max-width: 100vw !important;
                  max-height: 100vh !important;
                  object-fit: fill !important;
                }
                body.sipeed-stretch-mode div[data-input-region-host="screen"] {
                  width: 100vw !important;
                  height: 100vh !important;
                  transform: none !important;
                  left: 0 !important;
                  top: 0 !important;
                }
              `)};
              document.body.classList.toggle('sipeed-stretch-mode', ${isStretchFill ? 'true' : 'false'});
              window.dispatchEvent(new Event('resize'));
            } catch(e) {}
          })();
        `;
        el.executeJavaScript(injectScript).catch(() => {});
      }
    };

    const onFail = (e: any) => {
      // Ignore normal redirects or user aborts
      if (e?.errorCode !== -3 && e?.errorCode !== -20) {
        setIsLoading(false);
        setHasError(true);
      }
    };

    const onConsole = (e: any) => {
      const msg = e.message || '';
      if (msg.includes('__SIPEED_POINTER_LOCK_REQUEST__')) {
        // Safe exclusive mouse mode handling: acquire pointer lock on top-level window
        try {
          if (containerRef.current?.requestPointerLock) {
            containerRef.current.requestPointerLock();
            isPointerLockedRef.current = true;
          } else if (document.body.requestPointerLock) {
            document.body.requestPointerLock();
            isPointerLockedRef.current = true;
          }
        } catch (err) {
          console.warn('[KVM View] Top-level pointer lock request failed:', err);
        }
      } else if (msg.includes('__SIPEED_POINTER_LOCK_EXIT__')) {
        isPointerLockedRef.current = false;
        try {
          if (document.exitPointerLock) {
            document.exitPointerLock();
          }
        } catch {}
      } else {
        console.log('[Webview Console]', msg);
      }
    };

    // Prevent application crash if webview guest renderer process dies
    const onRenderGone = (e: any) => {
      console.warn('[Webview] Render process exited:', e?.reason, e?.exitCode);
      setIsLoading(false);
      setHasError(true);
      if (e?.reason !== 'clean-exit') {
        setTimeout(() => {
          try {
            if (el && typeof el.reload === 'function') {
              el.reload();
            }
          } catch {}
        }, 500);
      }
    };

    // Forward mouse movement deltas into webview when top-level cursor is locked
    const onHostMouseMove = (e: MouseEvent) => {
      if (isPointerLockedRef.current && document.pointerLockElement) {
        try {
          el.executeJavaScript(`
            window.postMessage({
              type: 'SIPEED_MOUSE_MOVE_DELTA',
              movementX: ${e.movementX},
              movementY: ${e.movementY},
              clientX: ${e.clientX},
              clientY: ${e.clientY}
            }, '*');
          `).catch(() => {});
        } catch {}
      }
    };

    // Notify webview when user presses ESC or loses pointer lock
    const onPointerLockChange = () => {
      if (!document.pointerLockElement && isPointerLockedRef.current) {
        isPointerLockedRef.current = false;
        try {
          el.executeJavaScript(`
            window.postMessage({ type: 'SIPEED_FORCE_UNLOCK_POINTER' }, '*');
          `).catch(() => {});
        } catch {}
      }
    };

    el.addEventListener('console-message', onConsole);
    el.addEventListener('render-process-gone', onRenderGone);
    el.addEventListener('did-finish-load', onFinish);
    el.addEventListener('dom-ready', onFinish);
    el.addEventListener('did-navigate', onFinish);
    el.addEventListener('did-navigate-in-page', onFinish);
    el.addEventListener('did-fail-load', onFail);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPointerLockedRef.current) {
          isPointerLockedRef.current = false;
          if (document.exitPointerLock && document.pointerLockElement) {
            document.exitPointerLock();
          }
          try {
            el.executeJavaScript(`
              window.postMessage({ type: 'SIPEED_FORCE_UNLOCK_POINTER' }, '*');
            `).catch(() => {});
          } catch {}
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousemove', onHostMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    return () => {
      el.removeEventListener('console-message', onConsole);
      el.removeEventListener('render-process-gone', onRenderGone);
      el.removeEventListener('did-finish-load', onFinish);
      el.removeEventListener('dom-ready', onFinish);
      el.removeEventListener('did-navigate', onFinish);
      el.removeEventListener('did-navigate-in-page', onFinish);
      el.removeEventListener('did-fail-load', onFail);

      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousemove', onHostMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }, [session.streamUrl, deviceCreds, isElectron, isStretchFill]);

  // Sync stretch mode dynamically whenever isStretchFill toggles
  useEffect(() => {
    const el = webviewRef.current;
    if (!el || !isDomReadyRef.current || typeof el.executeJavaScript !== 'function') return;
    try {
      el.executeJavaScript(`
        document.body.classList.toggle('sipeed-stretch-mode', ${isStretchFill ? 'true' : 'false'});
        window.dispatchEvent(new Event('resize'));
      `).catch(() => {});
    } catch {}
  }, [isStretchFill]);

  // Observe container resizes and trigger resize event inside webview to adapt canvas immediately
  useEffect(() => {
    const el = webviewRef.current;
    if (!el) return;

    const handleResize = () => {
      if (!isDomReadyRef.current) return;
      try {
        if (typeof el.executeJavaScript === 'function') {
          el.executeJavaScript('window.dispatchEvent(new Event("resize"));').catch(() => {});
        }
      } catch {}
    };

    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(() => {
      handleResize();
    });
    if (el.parentElement) {
      ro.observe(el.parentElement);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
    };
  }, []);

  const handleReload = () => {
    setIsLoading(true);
    setHasError(false);
    if (webviewRef.current) {
      try {
        if (typeof webviewRef.current.reload === 'function') {
          webviewRef.current.reload();
        } else {
          webviewRef.current.src = session.streamUrl;
        }
      } catch {
        webviewRef.current.src = session.streamUrl;
      }
    }
  };

  const handleOpenExternal = () => {
    if (window.kvmApi) {
      window.kvmApi.openPopout(session.deviceId, session.streamUrl);
    } else {
      window.open(session.streamUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      ref={containerRef}
      className={`kvm-viewport-container ${isFocused ? 'focused' : ''}`}
    >
      {/* Loading Overlay */}
      {isLoading && (
        <div className="kvm-loading-overlay animate-fade-in">
          <div className="loading-card">
            <RefreshCw size={24} className="animate-spin-slow text-accent-cyan" />
            <span className="loading-text">Conectando ao {session.title}...</span>
            <span className="loading-sub mono">{session.streamUrl}</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError ? (
        <div className="kvm-error-overlay animate-fade-in">
          <WifiOff size={42} className="text-status-offline mb-3" />
          <h3>Falha de Conexão com o NanoKVM</h3>
          <p className="error-desc">
            Não foi possível carregar a visualização integrada de {session.device.host}:{session.device.port}.
            Verifique se o dispositivo está acessível ou abra em uma janela destacada.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button className="app-button btn-secondary" onClick={handleReload}>
              <RefreshCw size={14} />
              <span>Tentar Novamente</span>
            </button>
            <button className="app-button btn-primary" onClick={handleOpenExternal}>
              <ExternalLink size={14} />
              <span>Abrir em Janela Separada</span>
            </button>
          </div>
        </div>
      ) : isElectron ? (
        /* Native Webview in Electron with top-level session context */
        <webview
          ref={webviewRef}
          src={session.streamUrl}
          partition="persist:nanokvm"
          className="kvm-frame"
          allowpopups={"true" as any}
          allowFullScreen={"true" as any}
          preload={webviewPreload}
          webpreferences="contextIsolation=no, nodeIntegration=no, webSecurity=no, allowRunningInsecureContent=yes"
          style={{ width: '100%', height: '100%', flex: 1, minHeight: '100%', border: 'none', display: 'inline-flex' }}
        />
      ) : (
        /* Fallback for regular web browsers */
        <>
          <div style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            background: 'rgba(12, 16, 23, 0.95)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            backdropFilter: 'blur(8px)',
            padding: '6px 14px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            fontSize: '12px',
            color: '#cbd5e1'
          }}>
            <span>💡 No navegador web, navegadores bloqueiam cookies em iframe. Abra em nova aba para logar:</span>
            <button
              onClick={handleOpenExternal}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                cursor: 'pointer',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px'
              }}
            >
              <ExternalLink size={13} />
              <span>Abrir em Nova Aba</span>
            </button>
          </div>
          <iframe
            ref={webviewRef}
            src={session.streamUrl}
            className="kvm-frame"
            allow="camera; microphone; display-capture; autoplay; clipboard-read; clipboard-write; gamepad"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
        </>
      )}
    </div>
  );
};
