"use client";

import { useState, useEffect, useCallback } from "react";
import { statsApi } from "../lib/api";
import type { RequestLog, PageMeta } from "../lib/api";

const DEFAULT_META: PageMeta = { total: 0, page: 1, limit: 50, pages: 1 };

export function useRequestLogs(limit = 50) {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [meta, setMeta] = useState<PageMeta>(DEFAULT_META);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (currentPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await statsApi.logs(currentPage, limit);
        setLogs(res.data);
        setMeta(res.meta);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load request logs");
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  const handleSetPage = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  return { logs, meta, loading, error, page, setPage: handleSetPage, refresh: () => fetchLogs(page) };
}
