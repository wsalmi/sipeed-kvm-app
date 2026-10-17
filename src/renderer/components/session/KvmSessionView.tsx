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
  const webviewRef = useRef<any>(null);
  const isDomReadyRef = useRef<boolean>(false);
  const isElectron = typeof window !== 'undefined' && Boolean((window as any).kvmApi) && !(window as any).kvmApi?.isMock;

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    isDomReadyRef.current = false;

    // If device has credentials, perform pre-authentication in background
    if (isElectron && session.device.username && session.device.password && window.kvmApi?.preAuth) {
      window.kvmApi.preAuth(session.device).then((res) => {
        if (res.success && webviewRef.current) {
          try {
            webviewRef.current.reload();
          } catch {}
        }
      }).catch(() => {});
    }

    // Timeout fallback if device does not load in 4s
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4000);

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
        const injectScript = `
          (function() {
            try {
              // Ensure nano-kvm-auth cookie is set for client router checks
              if (document.cookie.includes('nano-kvm-token=')) {
                document.cookie = "nano-kvm-auth=1; path=/; max-age=2592000; SameSite=Lax";
              }

              // Auto-fill credentials if registered on device and present on login form
              const u = document.querySelector('input[type="text"], input#username, input[placeholder*="user" i]');
              const p = document.querySelector('input[type="password"]');
              if (u && p && !p.value) {
                const setValue = (elem, val) => {
                  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(elem), 'value');
                  desc.set.call(elem, val);
                  elem.dispatchEvent(new Event('input', { bubbles: true }));
                  elem.dispatchEvent(new Event('change', { bubbles: true }));
                };
                setValue(u, ${JSON.stringify(session.device.username || '')});
                setValue(p, ${JSON.stringify(session.device.password || '')});
              }

              // Inject style to ensure webview document fills 100% of container
              const style = document.createElement('style');
              style.id = 'sipeed-full-area-style';
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
              if (!document.getElementById('sipeed-full-area-style')) {
                document.head.appendChild(style);
              } else {
                document.getElementById('sipeed-full-area-style').textContent = style.textContent;
              }
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
      console.log('[Webview Console]', e.message);
    };

    el.addEventListener('console-message', onConsole);
    el.addEventListener('did-finish-load', onFinish);
    el.addEventListener('dom-ready', onFinish);
    el.addEventListener('did-fail-load', onFail);

    return () => {
      el.removeEventListener('console-message', onConsole);
      el.removeEventListener('did-finish-load', onFinish);
      el.removeEventListener('dom-ready', onFinish);
      el.removeEventListener('did-fail-load', onFail);
    };
  }, [session.streamUrl, session.device.username, session.device.password, isElectron, isStretchFill]);

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
    <div className={`kvm-viewport-container ${isFocused ? 'focused' : ''}`}>
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
