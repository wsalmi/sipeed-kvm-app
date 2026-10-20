import { useState, useCallback } from 'react';
import { KvmDevice } from '../../shared/types/device';
import { ActiveSession, LayoutMode } from '../../shared/types/session';

export function useSessions() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single');

  const connectDevice = useCallback((device: KvmDevice) => {
    setSessions((prev) => {
      // Check if already open
      const existing = prev.find((s) => s.deviceId === device.id);
      if (existing) {
        setActiveSessionId(existing.id);
        return prev;
      }

      const targetHost = device.resolvedIp || device.host;
      const streamUrl = `${device.protocol}://${targetHost}:${device.port}/`;
      const newSession: ActiveSession = {
        id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        deviceId: device.id,
        device,
        title: device.name,
        connectedAt: Date.now(),
        isFocused: true,
        isMuted: false,
        isFullscreen: false,
        isExclusiveLock: false,
        streamUrl,
      };

      setActiveSessionId(newSession.id);
      return [...prev, newSession];
    });
  }, []);

  const closeSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
      }
      return remaining;
    });
  }, [activeSessionId]);

  const closeAllSessions = useCallback(() => {
    setSessions([]);
    setActiveSessionId(null);
  }, []);

  const focusSession = useCallback((sessionId: string | null) => {
    setActiveSessionId(sessionId);
  }, []);

  const openDevicesCatalog = useCallback(() => {
    setActiveSessionId(null);
  }, []);

  const openPopout = useCallback(async (target: string | KvmDevice, streamUrl?: string) => {
    if (!window.kvmApi) return;

    let deviceId: string;
    let url: string = streamUrl || '';

    if (typeof target === 'object' && target !== null && 'id' in target) {
      deviceId = target.id;
      if (!url) {
        const host = target.resolvedIp || target.host;
        url = `${target.protocol}://${host}:${target.port}/`;
      }
    } else {
      deviceId = target;
      if (!url) {
        const session = sessions.find((s) => s.id === target || s.deviceId === target);
        if (session) {
          deviceId = session.deviceId;
          url = session.streamUrl;
        }
      }
    }

    try {
      await window.kvmApi.openPopout(deviceId, url);
    } catch (err) {
      console.error('Failed to open popout window:', err);
    }
  }, [sessions]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return {
    sessions,
    activeSession,
    activeSessionId,
    layoutMode,
    setLayoutMode,
    connectDevice,
    closeSession,
    closeAllSessions,
    focusSession,
    openDevicesCatalog,
    openPopout,
  };
}
