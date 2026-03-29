import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogsTable } from "../components/LogsTable";
import type { RequestLog, PageMeta } from "../lib/api";

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

describe("LogsTable", () => {
  describe("loading state", () => {
    it("renders skeleton rows while loading", () => {
      const { container } = render(
        <LogsTable logs={[]} meta={makeMeta()} loading={true} onPageChange={vi.fn()} />
      );
      const pulseEls = container.querySelectorAll(".animate-pulse");
      expect(pulseEls.length).toBeGreaterThan(0);
    });
  });

  describe("empty state", () => {
    it("shows no-requests message when logs array is empty and not loading", () => {
      render(
        <LogsTable
          logs={[]}
          meta={makeMeta({ total: 0, pages: 0 })}
          loading={false}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByText(/no requests/i)).toBeInTheDocument();
    });
  });

  describe("column headers", () => {
    it("renders all required column headers", () => {
      render(
        <LogsTable logs={[makeLog()]} meta={makeMeta()} loading={false} onPageChange={vi.fn()} />
      );
      const headers = document.querySelectorAll("thead th");
      const headerTexts = Array.from(headers).map(h => h.textContent?.toLowerCase() ?? "");
      expect(headerTexts.some(t => t.includes("timestamp"))).toBe(true);
      expect(headerTexts.some(t => t === "key")).toBe(true);
      expect(headerTexts.some(t => t.includes("provider"))).toBe(true);
      expect(headerTexts.some(t => t.includes("model"))).toBe(true);
      expect(headerTexts.some(t => t.includes("tokens"))).toBe(true);
      expect(headerTexts.some(t => t.includes("cost"))).toBe(true);
      expect(headerTexts.some(t => t.includes("latency"))).toBe(true);
    });
  });

  describe("data rendering", () => {
    it("renders key_name in a row", () => {
      render(
        <LogsTable logs={[makeLog()]} meta={makeMeta()} loading={false} onPageChange={vi.fn()} />
      );
      expect(screen.getByText("prod-key")).toBeInTheDocument();
    });

    it("renders provider in a row", () => {
      render(
        <LogsTable logs={[makeLog()]} meta={makeMeta()} loading={false} onPageChange={vi.fn()} />
      );
      expect(screen.getByText(/openai/i)).toBeInTheDocument();
    });

    it("renders model in a row", () => {
      render(
        <LogsTable logs={[makeLog()]} meta={makeMeta()} loading={false} onPageChange={vi.fn()} />
      );
      expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    });

    it("renders formatted token count", () => {
      render(
        <LogsTable
          logs={[makeLog({ total_tokens: 1500 })]}
          meta={makeMeta()}
          loading={false}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByText("1.5K")).toBeInTheDocument();
    });

    it("renders latency in ms", () => {
      render(
        <LogsTable logs={[makeLog()]} meta={makeMeta()} loading={false} onPageChange={vi.fn()} />
      );
      expect(screen.getByText("512ms")).toBeInTheDocument();
    });

    it("renders multiple rows", () => {
      const logs = [
        makeLog({ id: 1, key_name: "key-alpha" }),
        makeLog({ id: 2, key_name: "key-beta" }),
        makeLog({ id: 3, key_name: "key-gamma" }),
      ];
      render(
        <LogsTable
          logs={logs}
          meta={makeMeta({ total: 3 })}
          loading={false}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByText("key-alpha")).toBeInTheDocument();
      expect(screen.getByText("key-beta")).toBeInTheDocument();
      expect(screen.getByText("key-gamma")).toBeInTheDocument();
    });
  });

  describe("cost formatting", () => {
    it("formats sub-cent costs with 4 decimal places", () => {
      render(
        <LogsTable
          logs={[makeLog({ cost_usd: 0.0045 })]}
          meta={makeMeta()}
          loading={false}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByText("$0.0045")).toBeInTheDocument();
    });

    it("formats costs over $0.01 with 2 decimal places", () => {
      render(
        <LogsTable
          logs={[makeLog({ cost_usd: 1.5 })]}
          meta={makeMeta()}
          loading={false}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByText("$1.50")).toBeInTheDocument();
    });
  });

  describe("pagination", () => {
    it("hides pagination when there is only one page", () => {
      render(
        <LogsTable
          logs={[makeLog()]}
          meta={makeMeta({ total: 1, pages: 1 })}
          loading={false}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /prev/i })).not.toBeInTheDocument();
    });

    it("shows pagination controls when there are multiple pages", () => {
      render(
        <LogsTable
          logs={Array.from({ length: 50 }, (_, i) => makeLog({ id: i }))}
          meta={makeMeta({ total: 100, page: 1, limit: 50, pages: 2 })}
          loading={false}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });

    it("calls onPageChange with next page when Next is clicked", () => {
      const onPageChange = vi.fn();
      render(
        <LogsTable
          logs={[makeLog()]}
          meta={makeMeta({ total: 100, page: 1, limit: 50, pages: 2 })}
          loading={false}
          onPageChange={onPageChange}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it("calls onPageChange with previous page when Prev is clicked", () => {
      const onPageChange = vi.fn();
      render(
        <LogsTable
          logs={[makeLog()]}
          meta={makeMeta({ total: 100, page: 2, limit: 50, pages: 2 })}
          loading={false}
          onPageChange={onPageChange}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /prev/i }));
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it("disables Prev button on first page", () => {
      render(
        <LogsTable
          logs={[makeLog()]}
          meta={makeMeta({ total: 100, page: 1, limit: 50, pages: 2 })}
          loading={false}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
    });

    it("disables Next button on last page", () => {
      render(
        <LogsTable
          logs={[makeLog()]}
          meta={makeMeta({ total: 100, page: 2, limit: 50, pages: 2 })}
          loading={false}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });

    it("shows current page and total pages", () => {
      render(
        <LogsTable
          logs={[makeLog()]}
          meta={makeMeta({ total: 100, page: 1, limit: 50, pages: 2 })}
          loading={false}
          onPageChange={vi.fn()}
        />
      );
      // Pagination area contains "Page 1 of 2" (may have whitespace nodes)
      const paginationEl = document.querySelector(".border-t span");
      expect(paginationEl?.textContent?.replace(/\s+/g, " ").trim()).toMatch(/Page 1 of 2/);
    });
  });

  describe("edge cases", () => {
    it("handles log with zero latency", () => {
      render(
        <LogsTable
          logs={[makeLog({ latency_ms: 0 })]}
          meta={makeMeta()}
          loading={false}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByText("0ms")).toBeInTheDocument();
    });

    it("handles log with zero cost", () => {
      render(
        <LogsTable
          logs={[makeLog({ cost_usd: 0 })]}
          meta={makeMeta()}
          loading={false}
          onPageChange={vi.fn()}
        />
      );
      // cost_usd=0 is < 0.01, so fmt$ gives 4 decimal places
      expect(screen.getByText("$0.0000")).toBeInTheDocument();
    });

    it("handles large token counts with M suffix", () => {
      render(
        <LogsTable
          logs={[makeLog({ total_tokens: 2_500_000 })]}
          meta={makeMeta()}
          loading={false}
          onPageChange={vi.fn()}
        />
      );
      expect(screen.getByText("2.5M")).toBeInTheDocument();
    });
  });
});
