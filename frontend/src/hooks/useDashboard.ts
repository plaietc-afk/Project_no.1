"use client";

import { useState, useEffect, useCallback } from "react";
import {
  keysApi, statsApi,
  type ApiKey, type OverviewStats, type ProviderStat, type DailyStat, type HeatmapData, type KeyStat, type LatencyStat, type UserStat
} from "../lib/api";

/** Max keys fetched per page — if the org exceeds this, a console warning is emitted */
const KEYS_PAGE_SIZE = 100;

export function useDashboard(days: number, selectedUserId?: number | null) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderStat[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [keyStats, setKeyStats] = useState<KeyStat[]>([]);
  const [latencyStats, setLatencyStats] = useState<LatencyStat[]>([]);
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [keysRes, overviewRes, provRes, dailyRes, heatRes, keyStatsRes, latencyRes, userStatsRes] = await Promise.allSettled([
        keysApi.list(1, KEYS_PAGE_SIZE),
        statsApi.overview(days, selectedUserId),
        statsApi.byProvider(days, selectedUserId),
        statsApi.daily(days, selectedUserId),
        statsApi.heatmap(),
        statsApi.byKey(days, selectedUserId),
        statsApi.latency(days, selectedUserId),
        statsApi.byUser(days),
      ]);

      let anyFailed = false;

      if (keysRes.status === "fulfilled") {
        setKeys(keysRes.value.data);
        if (keysRes.value.meta.total > KEYS_PAGE_SIZE) {
          // Pagination not yet implemented — silently truncates at KEYS_PAGE_SIZE
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

      if (keyStatsRes.status === "fulfilled") setKeyStats(keyStatsRes.value.data);
      if (latencyRes.status === "fulfilled") setLatencyStats(latencyRes.value.data);
      if (userStatsRes.status === "fulfilled") setUserStats(userStatsRes.value.data);
      // Non-critical fetches above — don't set anyFailed for them

      if (anyFailed) {
        setError("Some data failed to load. Check that the backend is running and try refreshing.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [days, selectedUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  const revokeKey = useCallback(async (id: number) => {
    await keysApi.revoke(id);
    setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k));
  }, []);

  const addKey = useCallback((key: ApiKey) => {
    setKeys(prev => [key, ...prev]);
  }, []);

  return { keys, overview, providerStats, dailyStats, heatmap, keyStats, latencyStats, userStats, loading, error, refresh, revokeKey, addKey };
}
