import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRequestLogs } from "../hooks/useRequestLogs";
import type { RequestLog, PageMeta } from "../lib/api";

const mockLogs = vi.fn();

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    statsApi: {
      ...actual.statsApi,
      logs: (...args: unknown[]) => mockLogs(...args),
    },
  };
});

function makeLog(overrides: Partial<RequestLog> = {}): RequestLog {
  return {
    id: 1,
    key_name: "prod-key",
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

function makeMeta(overrides: Partial<PageMeta> = {}): PageMeta {
  return { total: 1, page: 1, limit: 50, pages: 1, ...overrides };
}

describe("useRequestLogs", () => {
  beforeEach(() => {
    mockLogs.mockResolvedValue({ data: [makeLog()], meta: makeMeta() });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts in loading state before fetch resolves", () => {
    mockLogs.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useRequestLogs());
    expect(result.current.loading).toBe(true);
  });

  it("populates logs after successful fetch", async () => {
    const { result } = renderHook(() => useRequestLogs());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.logs).toHaveLength(1);
    expect(result.current.logs[0].key_name).toBe("prod-key");
  });

  it("populates meta after successful fetch", async () => {
    const { result } = renderHook(() => useRequestLogs());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.meta.total).toBe(1);
  });

  it("sets error on fetch failure", async () => {
    mockLogs.mockRejectedValue(new Error("Server down"));
    const { result } = renderHook(() => useRequestLogs());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Server down");
  });

  it("fetches page 2 when setPage is called with 2", async () => {
    const { result } = renderHook(() => useRequestLogs());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPage(2));
    await waitFor(() => expect(mockLogs).toHaveBeenCalledWith(2, 50));
  });

  it("calls logs API with default limit of 50", async () => {
    renderHook(() => useRequestLogs());
    await waitFor(() => expect(mockLogs).toHaveBeenCalledWith(1, 50));
  });

  it("calls logs API with custom limit", async () => {
    renderHook(() => useRequestLogs(25));
    await waitFor(() => expect(mockLogs).toHaveBeenCalledWith(1, 25));
  });
});
