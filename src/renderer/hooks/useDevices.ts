import { useState, useEffect, useCallback, useMemo } from 'react';
import { KvmDevice, DeviceGroup } from '../../shared/types/device';
import { useHealthStatus } from './useHealthStatus';

export function useDevices() {
  const [devices, setDevices] = useState<KvmDevice[]>([]);
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { healthMap, refreshDevice } = useHealthStatus();

  const loadData = useCallback(async () => {
    if (!window.kvmApi) return;
    try {
      setIsLoading(true);
      const [devList, grpList] = await Promise.all([
        window.kvmApi.getDevices(),
        window.kvmApi.getGroups(),
      ]);
      setDevices(devList || []);
      setGroups(grpList || []);
    } catch (err) {
      console.error('Failed to load devices/groups:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveDevice = useCallback(async (deviceData: Partial<KvmDevice>): Promise<KvmDevice | null> => {
    if (!window.kvmApi) return null;
    try {
      const now = Date.now();
      const deviceToSave: KvmDevice = {
        id: deviceData.id || `dev-${now}-${Math.random().toString(36).substring(2, 7)}`,
        name: deviceData.name?.trim() || 'Novo NanoKVM',
        host: deviceData.host?.trim() || '192.168.1.1',
        port: Number(deviceData.port) || 80,
        protocol: deviceData.protocol || 'http',
        model: deviceData.model || 'nanokvm-go',
        targetOS: deviceData.targetOS || 'auto',
        groupId: deviceData.groupId || 'all',
        tags: deviceData.tags || [],
        notes: deviceData.notes || '',
        username: deviceData.username || 'admin',
        password: deviceData.password,
        createdAt: deviceData.createdAt || now,
        updatedAt: now,
      };

      const saved = await window.kvmApi.saveDevice(deviceToSave);
      setDevices((prev) => {
        const exists = prev.some((d) => d.id === saved.id);
        if (exists) {
          return prev.map((d) => (d.id === saved.id ? saved : d));
        }
        return [...prev, saved];
      });
      return saved;
    } catch (err) {
      console.error('Failed to save device:', err);
      return null;
    }
  }, []);

  const deleteDevice = useCallback(async (id: string): Promise<boolean> => {
    if (!window.kvmApi) return false;
    try {
      const ok = await window.kvmApi.deleteDevice(id);
      if (ok) {
        setDevices((prev) => prev.filter((d) => d.id !== id));
      }
      return ok;
    } catch (err) {
      console.error('Failed to delete device:', err);
      return false;
    }
  }, []);

  // Merge devices with live health data
  const devicesWithHealth = useMemo(() => {
    return devices.map((d) => ({
      ...d,
      health: healthMap[d.id] || { status: 'checking' },
    }));
  }, [devices, healthMap]);

  // Filtered devices list based on group, search and status
  const filteredDevices = useMemo(() => {
    return devicesWithHealth.filter((d) => {
      // Group filter
      if (selectedGroupId !== 'all' && d.groupId !== selectedGroupId) {
        return false;
      }
      // Status filter
      if (statusFilter === 'online' && d.health?.status !== 'online') {
        return false;
      }
      if (statusFilter === 'offline' && d.health?.status !== 'offline') {
        return false;
      }
      // Search query filter (matches name, host, notes, or tags)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = d.name.toLowerCase().includes(q);
        const matchesHost = d.host.toLowerCase().includes(q);
        const matchesNotes = d.notes?.toLowerCase().includes(q) || false;
        const matchesTags = d.tags?.some((t) => t.toLowerCase().includes(q)) || false;
        if (!matchesName && !matchesHost && !matchesNotes && !matchesTags) {
          return false;
        }
      }
      return true;
    });
  }, [devicesWithHealth, selectedGroupId, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = devicesWithHealth.length;
    const online = devicesWithHealth.filter((d) => d.health?.status === 'online').length;
    const degraded = devicesWithHealth.filter((d) => d.health?.status === 'degraded').length;
    const offline = devicesWithHealth.filter((d) => d.health?.status === 'offline').length;
    return { total, online, degraded, offline };
  }, [devicesWithHealth]);

  return {
    devices: devicesWithHealth,
    filteredDevices,
    groups,
    selectedGroupId,
    setSelectedGroupId,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    isLoading,
    saveDevice,
    deleteDevice,
    refreshDevice,
    reload: loadData,
    stats,
  };
}
