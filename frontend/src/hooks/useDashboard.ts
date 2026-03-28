"use client";

import { useState, useEffect, useCallback } from "react";
import {
  keysApi, statsApi,
  type ApiKey, type OverviewStats, type ProviderStat, type DailyStat, type HeatmapData
} from "../lib/api";

export interface DashboardData {
  keys: ApiKey[];
  overview: OverviewStats | null;
  providerStats: ProviderStat[];
  dailyStats: DailyStat[];
  heatmap: HeatmapData | null;
  loading: boolean;
}

export function useDashboard(days: number) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderStat[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, overviewRes, provRes, dailyRes, heatRes] = await Promise.allSettled([
        keysApi.list(1, 100),
        statsApi.overview(days),
        statsApi.byProvider(days),
        statsApi.daily(days),
        statsApi.heatmap()
      ]);
      if (keysRes.status === "fulfilled") setKeys(keysRes.value.data);
      if (overviewRes.status === "fulfilled") setOverview(overviewRes.value.data);
      if (provRes.status === "fulfilled") setProviderStats(provRes.value.data);
      if (dailyRes.status === "fulfilled") setDailyStats(dailyRes.value.data);
      if (heatRes.status === "fulfilled") setHeatmap(heatRes.value.data);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { refresh(); }, [refresh]);

  const revokeKey = useCallback(async (id: number) => {
    await keysApi.revoke(id);
    setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k));
  }, []);

  const addKey = useCallback((key: ApiKey) => {
    setKeys(prev => [key, ...prev]);
  }, []);

  return { keys, overview, providerStats, dailyStats, heatmap, loading, refresh, revokeKey, addKey };
}
