/**
 * Webview Preload Script
 * Runs inside the guest <webview> before any page scripts load.
 *
 * Primary Purpose:
 * Intercepts Element.prototype.requestPointerLock and document.exitPointerLock.
 * In Chromium GuestView (<webview>), calling native requestPointerLock() hits
 * an assertion failure in check.cc (FATAL: check.cc(376) Check failed: false. NOTREACHED),
 * which terminates the entire Electron process.
 *
 * This preload safely polyfills pointer lock, coordinates with the host BrowserWindow,
 * and maintains full compatibility with NanoKVM's relative mouse mode.
 */

(function () {
  let isLocked = false;
  let currentLockTarget: Element | null = null;

  function dispatchLockChange() {
    try {
      const event = new Event('pointerlockchange', { bubbles: true, cancelable: false });
      document.dispatchEvent(event);
    } catch {}
  }

  function safeRequestPointerLock(this: Element): Promise<void> {
    currentLockTarget = this;
    isLocked = true;

    // Notify the host application embedder to lock cursor at window level
    console.log('__SIPEED_POINTER_LOCK_REQUEST__');

    setTimeout(() => {
      dispatchLockChange();
    }, 10);

    return Promise.resolve();
  }

  function safeExitPointerLock(): void {
    if (isLocked) {
      isLocked = false;
      currentLockTarget = null;

      // Notify the host application embedder to release cursor lock
      console.log('__SIPEED_POINTER_LOCK_EXIT__');

      setTimeout(() => {
        dispatchLockChange();
      }, 10);
    }
  }

  // Intercept requestPointerLock across Element and HTMLCanvasElement
  if (typeof Element !== 'undefined' && Element.prototype) {
    Element.prototype.requestPointerLock = safeRequestPointerLock;
  }
  if (typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype) {
    HTMLCanvasElement.prototype.requestPointerLock = safeRequestPointerLock;
  }

  // Intercept document.exitPointerLock and document.pointerLockElement
  if (typeof document !== 'undefined') {
    document.exitPointerLock = safeExitPointerLock;

    try {
      Object.defineProperty(document, 'pointerLockElement', {
        get() {
          return isLocked ? currentLockTarget : null;
        },
        configurable: true,
      });
    } catch {}
  }

  // Handle messages sent from embedder (e.g., when ESC is pressed on the host window)
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'SIPEED_FORCE_UNLOCK_POINTER') {
      safeExitPointerLock();
    } else if (event.data?.type === 'SIPEED_MOUSE_MOVE_DELTA') {
      if (isLocked && currentLockTarget) {
        try {
          const moveEvt = new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: event.data.clientX || 0,
            clientY: event.data.clientY || 0,
            movementX: event.data.movementX || 0,
            movementY: event.data.movementY || 0,
          });
          currentLockTarget.dispatchEvent(moveEvt);
        } catch {}
      }
    }
  });

  // Handle Escape key inside guest frame: always release pointer lock and exit fullscreen
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        safeExitPointerLock();
        console.log('__SIPEED_POINTER_LOCK_EXIT__');
        if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    },
    true
  );

  // macOS doesn't fire keyup for a key pressed while Cmd is held - only once Cmd
  // itself goes up. NanoKVM's web UI forwards keydown/keyup as HID reports, so
  // after Cmd+T the remote sees T held down until Cmd is released and its own
  // key repeat kicks in (Cmd+T opens a pile of tabs, Cmd+V pastes many times).
  // Send the missing keyup ourselves shortly after the keydown.
  const isMacClient = /Mac/i.test(navigator.platform || navigator.userAgent);
  const MODIFIER_CODE = /^(Meta|OS|Control|Shift|Alt|CapsLock|Fn)/;
  const CMD_KEYUP_DELAY_MS = 50;

  if (isMacClient) {
    window.addEventListener(
      'keydown',
      (e) => {
        if (!e.isTrusted || !e.metaKey || !e.code || MODIFIER_CODE.test(e.code)) return;

        const { code, key, location } = e;
        const target = e.target instanceof Node && e.target.isConnected ? e.target : document;

        setTimeout(() => {
          target.dispatchEvent(
            new KeyboardEvent('keyup', {
              code,
              key,
              location,
              metaKey: true,
              bubbles: true,
              cancelable: true,
              composed: true,
            })
          );
        }, CMD_KEYUP_DELAY_MS);
      },
      true
    );
  }
})();
