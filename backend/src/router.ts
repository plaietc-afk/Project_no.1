import { ChatCompletionRequest, ChatCompletionResponse, StreamResult } from './providers/base';
import { ProviderRegistry } from './providers';

export interface RouterEntry {
  provider: string;
  model: string;
}

// Errors that warrant trying the next provider
const RETRYABLE_CODES = new Set([429, 500, 502, 503, 504]);

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message;
    // Match "Status: 429" or "Error: 429" patterns from provider adapters
    const statusMatch = msg.match(/\b(\d{3})\b/);
    if (statusMatch) {
      const code = parseInt(statusMatch[1], 10);
      return RETRYABLE_CODES.has(code);
    }
    // Network-level errors are always retryable
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
      return true;
    }
  }
  return false;
}

export class RouterExhaustedError extends Error {
  readonly attempts: Array<{ provider: string; error: string }>;

  constructor(attempts: Array<{ provider: string; error: string }>) {
    super(`All providers failed after ${attempts.length} attempt(s)`);
    this.name = 'RouterExhaustedError';
    this.attempts = attempts;
  }
}

export class SmartRouter {
  // Route a request through a priority list of providers, falling back on retryable errors.
  // `routerConfig` is parsed from the api_key record; if empty, falls back to `defaultProvider`.
  static async route(
    req: ChatCompletionRequest,
    defaultProvider: string,
    routerConfig: RouterEntry[] | null
  ): Promise<ChatCompletionResponse & { _provider: string; _latencyMs: number }> {
    const entries: RouterEntry[] = routerConfig && routerConfig.length > 0
      ? routerConfig
      : [{ provider: defaultProvider, model: req.model }];

    const attempts: Array<{ provider: string; error: string }> = [];
    const tried = new Set<string>();

    for (const entry of entries) {
      const providerKey = entry.provider.toLowerCase();
      if (tried.has(providerKey)) continue;
      tried.add(providerKey);

      const adapter = ProviderRegistry[providerKey];
      if (!adapter) {
        attempts.push({ provider: providerKey, error: 'Provider not registered' });
        continue;
      }

      const providerApiKey = process.env[`${providerKey.toUpperCase()}_API_KEY`];
      if (!providerApiKey) {
        attempts.push({ provider: providerKey, error: 'API key environment variable not set' });
        continue;
      }

      const modelToUse = entry.model || req.model;
      const routedReq: ChatCompletionRequest = { ...req, model: modelToUse };

      const startMs = Date.now();
      try {
        const result = await adapter.chatCompletion(routedReq, providerApiKey);
        const latencyMs = Date.now() - startMs;
        console.log(`[Router] ${providerKey}/${modelToUse} succeeded in ${latencyMs}ms`);
        return { ...result, _provider: providerKey, _latencyMs: latencyMs };
      } catch (err: unknown) {
        const latencyMs = Date.now() - startMs;
        const errMsg = err instanceof Error ? err.message : String(err);
        attempts.push({ provider: providerKey, error: errMsg });
        console.warn(`[Router] ${providerKey}/${modelToUse} failed in ${latencyMs}ms: ${errMsg}`);

        if (!isRetryableError(err)) {
          // Non-retryable error (e.g. bad request, auth failure) — stop immediately
          throw err;
        }
        // Retryable — try next provider
      }
    }

    throw new RouterExhaustedError(attempts);
  }

  // Streaming variant — calls chatCompletionStream on the first provider that supports it.
  // Falls back to non-streaming providers if none support streaming.
  static async routeStream(
    req: ChatCompletionRequest,
    defaultProvider: string,
    routerConfig: RouterEntry[] | null
  ): Promise<StreamResult & { _provider: string; _latencyMs: number }> {
    const entries: RouterEntry[] = routerConfig && routerConfig.length > 0
      ? routerConfig
      : [{ provider: defaultProvider, model: req.model }];

    const attempts: Array<{ provider: string; error: string }> = [];
    const tried = new Set<string>();

    for (const entry of entries) {
      const providerKey = entry.provider.toLowerCase();
      if (tried.has(providerKey)) continue;
      tried.add(providerKey);

      const adapter = ProviderRegistry[providerKey];
      if (!adapter || !adapter.chatCompletionStream) {
        attempts.push({ provider: providerKey, error: 'Provider does not support streaming' });
        continue;
      }

      const providerApiKey = process.env[`${providerKey.toUpperCase()}_API_KEY`];
      if (!providerApiKey) {
        attempts.push({ provider: providerKey, error: 'API key environment variable not set' });
        continue;
      }

      const modelToUse = entry.model || req.model;
      const routedReq: ChatCompletionRequest = { ...req, model: modelToUse };
      const startMs = Date.now();

      try {
        const result = await adapter.chatCompletionStream(routedReq, providerApiKey);
        const latencyMs = Date.now() - startMs;
        return { ...result, _provider: providerKey, _latencyMs: latencyMs };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        attempts.push({ provider: providerKey, error: errMsg });
        if (!isRetryableError(err)) throw err;
      }
    }

    throw new RouterExhaustedError(attempts);
  }
}
