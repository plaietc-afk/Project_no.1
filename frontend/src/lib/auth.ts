const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options
  });
  const json = await res.json();
  if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : `HTTP ${res.status}`);
  return json as T;
}

export interface Package {
  id: number;
  name: string;
  display_name: string;
  token_quota: number;
  usd_budget: number;
  rpm_limit: number;
  allowed_models: string[];
}

export interface AuthUser {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  usage: {
    tokens_used: number;
    usd_spent: number;
    usage_reset_at: string | null;
  };
  package: Package | null;
}

export const authApi = {
  register: (email: string, password: string, full_name?: string) =>
    authFetch<{ success: boolean; data: { user: AuthUser; api_key: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name })
    }),

  login: (email: string, password: string) =>
    authFetch<{ success: boolean; data: { user: AuthUser } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  logout: () =>
    authFetch<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  me: () =>
    authFetch<{ success: boolean; data: AuthUser }>('/auth/me'),

  changePassword: (current_password: string, new_password: string) =>
    authFetch<{ success: boolean; message: string }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password })
    })
};
