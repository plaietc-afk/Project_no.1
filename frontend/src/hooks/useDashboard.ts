"use client";

import { useState, useEffect, useCallback } from "react";
import {
  keysApi, statsApi,
  type ApiKey, type OverviewStats, type ProviderStat, type DailyStat, type HeatmapData
} from "../lib/api";

/** Max keys fetched per page — if the org exceeds this, a console warning is emitted */
const KEYS_PAGE_SIZE = 100;

export function useDashboard(days: number) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderStat[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [keysRes, overviewRes, provRes, dailyRes, heatRes] = await Promise.allSettled([
        keysApi.list(1, KEYS_PAGE_SIZE),
        statsApi.overview(days),
        statsApi.byProvider(days),
        statsApi.daily(days),
        statsApi.heatmap()
      ]);

      let anyFailed = false;

      if (keysRes.status === "fulfilled") {
        setKeys(keysRes.value.data);
        if (keysRes.value.meta.total > KEYS_PAGE_SIZE) {
          // Warn in dev — pagination support is a future improvement
          console.warn(`TokenGuard: ${keysRes.value.meta.total} keys exist but only ${KEYS_PAGE_SIZE} are shown. Pagination not yet implemented.`);
        }
      } else { anyFailed = true; }

      if (overviewRes.status === "fulfilled") setOverview(overviewRes.value.data);
      else anyFailed = true;

      if (provRes.status === "fulfilled") setProviderStats(provRes.value.data);
      else anyFailed = true;

      if (dailyRes.status === "fulfilled") setDailyStats(dailyRes.value.data);
      else anyFailed = true;

      if (heatRes.status === "fulfilled") setHeatmap(heatRes.value.data);
      else anyFailed = true;

      if (anyFailed) {
        setError("Some data failed to load. Check that the backend is running and try refreshing.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard data");
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

  return { keys, overview, providerStats, dailyStats, heatmap, loading, error, refresh, revokeKey, addKey };
}
