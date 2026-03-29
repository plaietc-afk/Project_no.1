import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { KeyDrillDown } from "../components/KeyDrillDown";
import type { ApiKey, RequestLog, PageMeta, DailyStat, ProviderStat } from "../lib/api";

// --- Fixtures ---

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 1,
    key_name: "prod-key",
    provider: "openai",
    budget: 100,
    project_id: null,
    webhook_url: null,
    alert_thresholds: [],
    last_alert_percentage: 0,
    rpm_limit: 0,
    tpm_limit: 0,
    is_active: true,
    router_config: null,
    created_at: "2024-01-01T00:00:00Z",
    key_prefix: "sk-tg-abc1",
    ...overrides,
  };
}

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

const DAILY_STATS: DailyStat[] = [
  { date: "2024-01-15", total_tokens: 5000, total_cost_usd: 0.25, total_requests: 10 },
];

const PROVIDER_STATS: ProviderStat[] = [
  { provider: "openai", total_tokens: 5000, total_cost_usd: 0.25, total_requests: 10 },
];

// --- Mock statsApi ---
const mockLogs = vi.fn();
const mockDaily = vi.fn();
const mockByProvider = vi.fn();

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    statsApi: {
      ...actual.statsApi,
      logs: (...args: unknown[]) => mockLogs(...args),
      daily: (...args: unknown[]) => mockDaily(...args),
      byProvider: (...args: unknown[]) => mockByProvider(...args),
    },
  };
});

describe("KeyDrillDown", () => {
  beforeEach(() => {
    mockLogs.mockResolvedValue({ data: [makeLog()], meta: makeMeta() });
    mockDaily.mockResolvedValue({ data: DAILY_STATS });
    mockByProvider.mockResolvedValue({ data: PROVIDER_STATS });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("visibility", () => {
    it("renders nothing when apiKey is null", () => {
      const { container } = render(
        <KeyDrillDown apiKey={null} onClose={vi.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders panel when apiKey is provided", async () => {
      render(<KeyDrillDown apiKey={makeKey()} onClose={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText("prod-key")).toBeInTheDocument();
      });
    });
  });

  describe("close behaviour", () => {
    it("calls onClose when close button is clicked", async () => {
      const onClose = vi.fn();
      render(<KeyDrillDown apiKey={makeKey()} onClose={onClose} />);
      await waitFor(() => screen.getByText("prod-key"));
      fireEvent.click(screen.getByRole("button", { name: /close/i }));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("calls onClose when backdrop is clicked", async () => {
      const onClose = vi.fn();
      render(<KeyDrillDown apiKey={makeKey()} onClose={onClose} />);
      await waitFor(() => screen.getByText("prod-key"));
      // Click the backdrop overlay (the outermost fixed div)
      const backdrop = document.querySelector("[data-testid='drilldown-backdrop']");
      if (backdrop) fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe("data fetching", () => {
    it("fetches logs with key_id filter", async () => {
      render(<KeyDrillDown apiKey={makeKey({ id: 7 })} onClose={vi.fn()} />);
      await waitFor(() => {
        expect(mockLogs).toHaveBeenCalledWith(1, 50, 7);
      });
    });

    it("fetches daily stats", async () => {
      render(<KeyDrillDown apiKey={makeKey()} onClose={vi.fn()} />);
      await waitFor(() => {
        expect(mockDaily).toHaveBeenCalled();
      });
    });

    it("fetches provider stats", async () => {
      render(<KeyDrillDown apiKey={makeKey()} onClose={vi.fn()} />);
      await waitFor(() => {
        expect(mockByProvider).toHaveBeenCalled();
      });
    });
  });

  describe("content rendering", () => {
    it("shows loading skeleton initially", () => {
      // Make mock hang so we observe loading state
      mockLogs.mockReturnValue(new Promise(() => undefined));
      mockDaily.mockReturnValue(new Promise(() => undefined));
      mockByProvider.mockReturnValue(new Promise(() => undefined));

      const { container } = render(
        <KeyDrillDown apiKey={makeKey()} onClose={vi.fn()} />
      );
      expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });

    it("renders BarChart after data loads", async () => {
      render(<KeyDrillDown apiKey={makeKey()} onClose={vi.fn()} />);
      // BarChart renders its container; verify the section heading
      await waitFor(() => {
        expect(screen.getByText(/daily cost/i)).toBeInTheDocument();
      });
    });

    it("renders ProviderPie after data loads", async () => {
      render(<KeyDrillDown apiKey={makeKey()} onClose={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText(/cost by provider/i)).toBeInTheDocument();
      });
    });

    it("renders logs table after data loads", async () => {
      render(<KeyDrillDown apiKey={makeKey()} onClose={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText(/recent requests/i)).toBeInTheDocument();
      });
    });

    it("renders log row data", async () => {
      render(<KeyDrillDown apiKey={makeKey()} onClose={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText("gpt-4o")).toBeInTheDocument();
      });
    });
  });

  describe("error handling", () => {
    it("shows error message when all fetches fail", async () => {
      mockLogs.mockRejectedValue(new Error("API error"));
      mockDaily.mockRejectedValue(new Error("API error"));
      mockByProvider.mockRejectedValue(new Error("API error"));

      render(<KeyDrillDown apiKey={makeKey()} onClose={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });
  });

  describe("re-fetch on key change", () => {
    it("fetches data for new key when apiKey prop changes", async () => {
      const { rerender } = render(
        <KeyDrillDown apiKey={makeKey({ id: 1 })} onClose={vi.fn()} />
      );
      await waitFor(() => expect(mockLogs).toHaveBeenCalledWith(1, 50, 1));

      rerender(<KeyDrillDown apiKey={makeKey({ id: 2, key_name: "other-key" })} onClose={vi.fn()} />);
      await waitFor(() => expect(mockLogs).toHaveBeenCalledWith(1, 50, 2));
    });
  });
});
