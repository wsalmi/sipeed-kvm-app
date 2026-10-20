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
        setTimeout(() => setShowHud(false), 3500);
      } else {
        setShowHud(false);
        // Release any pointer lock when leaving fullscreen
        if (document.exitPointerLock && document.pointerLockElement) {
          document.exitPointerLock();
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

      // Sync state whenever window fullscreen changes externally (e.g. macOS native fullscreen or shortcuts)
      if (typeof window.kvmApi.onFullscreenChange === 'function') {
        const cleanup = window.kvmApi.onFullscreenChange((isFull) => {
          setIsFullscreen(isFull);
          if (isFull) {
            setShowHud(true);
            setTimeout(() => setShowHud(false), 3500);
          } else {
            setShowHud(false);
            if (document.exitPointerLock && document.pointerLockElement) {
              document.exitPointerLock();
            }
          }
        });
        return cleanup;
      }
    }
  }, []);

  useEffect(() => {
    // Keyboard shortcut listener
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC always exits fullscreen
      if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // macOS native shortcut (Cmd+Ctrl+F)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && (e.ctrlKey || e.metaKey && e.shiftKey)) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // Configured shortcut (e.g. F11)
      if (e.key === shortcut || e.code === shortcut) {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcut, isFullscreen, toggleFullscreen]);

  return {
    isFullscreen,
    showHud,
    toggleFullscreen,
    dismissHud: () => setShowHud(false),
  };
}
