import { useState, useEffect, useCallback } from 'react';
import { DeviceHealth } from '../../shared/types/device';

export function useHealthStatus() {
  const [healthMap, setHealthMap] = useState<Record<string, DeviceHealth>>({});

  useEffect(() => {
    if (!window.kvmApi) return;

    // Load initial health map
    window.kvmApi.getHealthMap().then((data) => {
      if (data) setHealthMap(data);
    }).catch(console.error);

    // Subscribe to IPC live updates
    const unsubscribe = window.kvmApi.onHealthUpdate((updatedMap) => {
      setHealthMap((prev) => ({ ...prev, ...updatedMap }));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const refreshDevice = useCallback(async (deviceId: string) => {
    if (!window.kvmApi) return;
    setHealthMap((prev) => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], status: 'checking' },
    }));
    try {
      const result = await window.kvmApi.checkDeviceHealth(deviceId);
      setHealthMap((prev) => ({ ...prev, [deviceId]: result }));
    } catch (err) {
      console.error('Failed to refresh health for device:', deviceId, err);
    }
  }, []);

  const refreshAllHealth = useCallback(async () => {
    if (!window.kvmApi) return;
    try {
      if (typeof window.kvmApi.checkAllHealth === 'function') {
        const result = await window.kvmApi.checkAllHealth();
        if (result) setHealthMap(result);
      }
    } catch (err) {
      console.error('Failed to refresh health for all devices:', err);
    }
  }, []);

  return { healthMap, refreshDevice, refreshAllHealth };
}
