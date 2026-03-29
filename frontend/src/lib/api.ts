const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json as T;
}

// ---- Types ----

export interface ApiKey {
  id: number;
  key_name: string;
  provider: string;
  budget: number;
  project_id: string | null;
  webhook_url: string | null;
  alert_thresholds: number[];
  last_alert_percentage: number;
  rpm_limit: number;
  tpm_limit: number;
  is_active: boolean;
  router_config: Array<{ provider: string; model: string }> | null;
  created_at: string;
  key_prefix: string;
  api_key?: string; // only present on creation
}

export interface CreateKeyPayload {
  key_name: string;
  provider: string;
  budget?: number;
  project_id?: string;
  webhook_url?: string;
  alert_thresholds?: number[];
  rpm_limit?: number;
  tpm_limit?: number;
  router_config?: Array<{ provider: string; model: string }>;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface OverviewStats {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_cost_usd: number;
  total_cost_saved_usd: number;
  total_requests: number;
  cached_requests: number;
  from: string;
  to: string;
}

export interface ProviderStat {
  provider: string;
  total_tokens: number;
  total_cost_usd: number;
  total_requests: number;
}

export interface DailyStat {
  date: string;
  total_tokens: number;
  total_cost_usd: number;
  total_requests: number;
}

export interface HeatmapDay {
  date: string;
  total_tokens: number;
  total_requests: number;
  intensity: number; // 0-4
}

export interface HeatmapData {
  year: number;
  days: HeatmapDay[];
  max_tokens: number;
}

export interface RequestLog {
  id: number;
  key_name: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  timestamp: string;
  status_code: number;
  cached: boolean;
}

export interface KeyStat {
  key_id: number;
  key_name: string;
  provider: string;
  total_tokens: number;
  total_cost_usd: number;
  total_requests: number;
}

export interface LatencyStat {
  provider: string;
  p50_ms: number;
  p95_ms: number;
  avg_ms: number;
  request_count: number;
}

export interface User {
  id: number;
  display_name: string;
  role: string;
  created_at: string;
}

export interface UserStat {
  user_id: number;
  display_name: string;
  total_tokens: number;
  total_cost_usd: number;
  total_requests: number;
}

export interface ModelClass {
  class: string;
  display_name: string;
}

export interface CostComparisonResult {
  provider: string;
  model: string;
  prompt_cost_usd: number;
  completion_cost_usd: number;
  total_cost_usd: number;
  prompt_per_1k: number;
  completion_per_1k: number;
}

// ---- API functions ----

export const keysApi = {
  list: (page = 1, limit = 20) =>
    apiFetch<{ success: boolean; data: ApiKey[]; meta: PageMeta }>(`/api/keys?page=${page}&limit=${limit}`),

  create: (payload: CreateKeyPayload) =>
    apiFetch<{ success: boolean; data: ApiKey }>('/api/keys', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  update: (id: number, payload: Partial<CreateKeyPayload>) =>
    apiFetch<{ success: boolean; data: ApiKey }>(`/api/keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  revoke: (id: number) =>
    apiFetch<{ success: boolean; message: string }>(`/api/keys/${id}`, { method: 'DELETE' }),

  rotate: (id: number) =>
    apiFetch<{ success: boolean; api_key: string; message: string }>(`/api/keys/${id}/rotate`, { method: 'POST' }),

  testWebhook: (webhookUrl: string) =>
    apiFetch<{ success: boolean; status: number }>('/api/keys/test-webhook', {
      method: 'POST',
      body: JSON.stringify({ webhook_url: webhookUrl })
    })
};

export const statsApi = {
  overview: (days = 30) =>
    apiFetch<{ success: boolean; data: OverviewStats }>(`/api/stats/overview?days=${days}`),

  byProvider: (days = 30) =>
    apiFetch<{ success: boolean; data: ProviderStat[] }>(`/api/stats/by-provider?days=${days}`),

  daily: (days = 30) =>
    apiFetch<{ success: boolean; data: DailyStat[] }>(`/api/stats/daily?days=${days}`),

  heatmap: (year?: number) =>
    apiFetch<{ success: boolean; data: HeatmapData }>(`/api/stats/heatmap${year ? `?year=${year}` : ''}`),

  logs: (page = 1, limit = 50, key_id?: number) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (key_id !== undefined) params.set("key_id", String(key_id));
    return apiFetch<{ success: boolean; data: RequestLog[]; meta: PageMeta }>(`/api/stats/logs?${params}`);
  },

  byKey: (days = 30) =>
    apiFetch<{ success: boolean; data: KeyStat[] }>(`/api/stats/by-key?days=${days}`),

  byUser: (days = 30) =>
    apiFetch<{ success: boolean; data: UserStat[] }>(`/api/stats/by-user?days=${days}`),

  latency: (days = 30) =>
    apiFetch<{ success: boolean; data: LatencyStat[] }>(`/api/stats/latency?days=${days}`),

  costComparisonClasses: () =>
    apiFetch<{ success: boolean; data: ModelClass[] }>('/api/stats/cost-comparison/classes'),

  costComparison: (promptTokens: number, completionTokens: number, modelClass: string) => {
    const params = new URLSearchParams({ prompt_tokens: String(promptTokens), completion_tokens: String(completionTokens), model_class: modelClass });
    return apiFetch<{ success: boolean; data: CostComparisonResult[]; meta: { prompt_tokens: number; completion_tokens: number; model_class: string } }>(`/api/stats/cost-comparison?${params}`);
  }
};

export const usersApi = {
  list: () =>
    apiFetch<{ success: boolean; data: User[] }>('/api/users'),

  create: (display_name: string) =>
    apiFetch<{ success: boolean; data: User }>('/api/users', {
      method: 'POST',
      body: JSON.stringify({ display_name })
    }),

  update: (id: number, display_name: string) =>
    apiFetch<{ success: boolean; data: User }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ display_name })
    }),

  remove: (id: number) =>
    apiFetch<{ success: boolean; message: string }>(`/api/users/${id}`, { method: 'DELETE' })
};
