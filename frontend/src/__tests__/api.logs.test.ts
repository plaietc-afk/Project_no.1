import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { statsApi } from "../lib/api";
import type { RequestLog, PageMeta } from "../lib/api";

// --- Helpers ---
function makeMeta(overrides: Partial<PageMeta> = {}): PageMeta {
  return { total: 0, page: 1, limit: 50, pages: 1, ...overrides };
}

function makeLog(overrides: Partial<RequestLog> = {}): RequestLog {
  return {
    id: 1,
    key_name: "test-key",
    provider: "openai",
    model: "gpt-4o",
    prompt_tokens: 100,
    completion_tokens: 200,
    total_tokens: 300,
    cost_usd: 0.0045,
    latency_ms: 512,
    timestamp: "2024-01-15T10:30:00Z",
    status_code: 200,
    cached: false,
    ...overrides,
  };
}

describe("statsApi.logs", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [makeLog()],
          meta: makeMeta({ total: 1, pages: 1 }),
        }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the correct URL with default page and limit", async () => {
    await statsApi.logs();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/stats/logs?page=1&limit=50"),
      expect.any(Object)
    );
  });

  it("calls the correct URL with custom page and limit", async () => {
    await statsApi.logs(2, 25);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/stats/logs?page=2&limit=25"),
      expect.any(Object)
    );
  });

  it("calls the correct URL filtered by key_id", async () => {
    await statsApi.logs(1, 50, 42);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("key_id=42"),
      expect.any(Object)
    );
  });

  it("returns typed data and meta on success", async () => {
    const result = await statsApi.logs();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].key_name).toBe("test-key");
    expect(result.meta.total).toBe(1);
  });

  it("throws on HTTP error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal Server Error" }),
      })
    );
    await expect(statsApi.logs()).rejects.toThrow("Internal Server Error");
  });

  it("throws on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    await expect(statsApi.logs()).rejects.toThrow("Network error");
  });
});

describe("statsApi.byKey", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the correct URL with default days", async () => {
    await statsApi.byKey();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/stats/by-key?days=30"),
      expect.any(Object)
    );
  });

  it("calls the correct URL with custom days", async () => {
    await statsApi.byKey(7);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/stats/by-key?days=7"),
      expect.any(Object)
    );
  });

  it("returns typed data on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              key_id: 1,
              key_name: "prod-key",
              provider: "anthropic",
              total_tokens: 5000,
              total_cost_usd: 0.25,
              total_requests: 10,
            },
          ],
        }),
      })
    );
    const result = await statsApi.byKey();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].key_name).toBe("prod-key");
  });
});
