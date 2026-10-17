import { useState, useEffect, useCallback } from 'react';

interface UseFullscreenLockOptions {
  shortcut?: string; // e.g. 'F11'
  onToggle?: (isFullscreen: boolean) => void;
}

export function useFullscreenLock(options: UseFullscreenLockOptions = {}) {
  const { shortcut = 'F11', onToggle } = options;
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showHud, setShowHud] = useState<boolean>(false);

  const toggleFullscreen = useCallback(async () => {
    if (!window.kvmApi) return;
    try {
      const newState = await window.kvmApi.toggleFullscreen();
      setIsFullscreen(newState);
      onToggle?.(newState);

      if (newState) {
        // Show exclusive mode HUD temporarily
        setShowHud(true);
        setTimeout(() => setShowHud(false), 2800);

        // Try Pointer Lock if in fullscreen
        try {
          if (document.documentElement.requestPointerLock) {
            document.documentElement.requestPointerLock();
          }
        } catch (e) {
          console.warn('[FullscreenLock] Pointer lock failed:', e);
        }

        // Try Keyboard Lock API to prevent local browser/OS shortcuts from intercepting games
        try {
          if ('keyboard' in navigator && (navigator as any).keyboard?.lock) {
            await (navigator as any).keyboard.lock();
            console.log('[FullscreenLock] Keyboard locked exclusively for remote session');
          }
        } catch (e) {
          console.warn('[FullscreenLock] Keyboard lock failed:', e);
        }
      } else {
        setShowHud(false);
        // Release locks
        if (document.exitPointerLock) {
          document.exitPointerLock();
        }
        if ('keyboard' in navigator && (navigator as any).keyboard?.unlock) {
          (navigator as any).keyboard.unlock();
        }
      }
    } catch (err) {
      console.error('Failed to toggle fullscreen:', err);
    }
  }, [onToggle]);

  useEffect(() => {
    // Check initial state
    if (window.kvmApi) {
      window.kvmApi.isFullscreen().then(setIsFullscreen).catch(() => {});
    }

    // Keyboard shortcut listener
    const handleKeyDown = (e: KeyboardEvent) => {
      // Normalizes matching e.g. 'F11', 'Escape', etc.
      if (e.key === shortcut || e.code === shortcut) {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcut, toggleFullscreen]);

  return {
    isFullscreen,
    showHud,
    toggleFullscreen,
    dismissHud: () => setShowHud(false),
  };
}
