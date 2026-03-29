import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { statsApi, keysApi } from "../lib/api";

// Mock successful response factory
function mockOk(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => body })
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("statsApi pre-existing functions", () => {
  describe("statsApi.overview", () => {
    beforeEach(() => mockOk({ success: true, data: {} }));

    it("calls /api/stats/overview with default days=30", async () => {
      await statsApi.overview();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/stats/overview?days=30"),
        expect.any(Object)
      );
    });

    it("calls with custom days", async () => {
      await statsApi.overview(7);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("days=7"),
        expect.any(Object)
      );
    });
  });

  describe("statsApi.byProvider", () => {
    beforeEach(() => mockOk({ success: true, data: [] }));

    it("calls /api/stats/by-provider with default days=30", async () => {
      await statsApi.byProvider();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/stats/by-provider?days=30"),
        expect.any(Object)
      );
    });
  });

  describe("statsApi.daily", () => {
    beforeEach(() => mockOk({ success: true, data: [] }));

    it("calls /api/stats/daily with default days=30", async () => {
      await statsApi.daily();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/stats/daily?days=30"),
        expect.any(Object)
      );
    });
  });

  describe("statsApi.heatmap", () => {
    beforeEach(() => mockOk({ success: true, data: { year: 2024, days: [], max_tokens: 0 } }));

    it("calls /api/stats/heatmap without year param by default", async () => {
      await statsApi.heatmap();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/stats/heatmap"),
        expect.any(Object)
      );
    });

    it("calls with year param when provided", async () => {
      await statsApi.heatmap(2023);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("year=2023"),
        expect.any(Object)
      );
    });
  });
});

describe("keysApi pre-existing functions", () => {
  describe("keysApi.list", () => {
    beforeEach(() =>
      mockOk({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 1 } })
    );

    it("calls /api/keys with default page and limit", async () => {
      await keysApi.list();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/keys?page=1&limit=20"),
        expect.any(Object)
      );
    });

    it("calls with custom page and limit", async () => {
      await keysApi.list(2, 50);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/keys?page=2&limit=50"),
        expect.any(Object)
      );
    });
  });

  describe("keysApi.create", () => {
    beforeEach(() => mockOk({ success: true, data: {} }));

    it("sends POST to /api/keys with payload", async () => {
      await keysApi.create({ key_name: "test", provider: "openai" });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/keys"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("keysApi.update", () => {
    beforeEach(() => mockOk({ success: true, data: {} }));

    it("sends PUT to /api/keys/:id", async () => {
      await keysApi.update(3, { key_name: "updated" });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/keys/3"),
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  describe("keysApi.revoke", () => {
    beforeEach(() => mockOk({ success: true, message: "ok" }));

    it("sends DELETE to /api/keys/:id", async () => {
      await keysApi.revoke(5);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/keys/5"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("keysApi.rotate", () => {
    beforeEach(() => mockOk({ success: true, api_key: "new-key", message: "ok" }));

    it("sends POST to /api/keys/:id/rotate", async () => {
      await keysApi.rotate(7);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/keys/7/rotate"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("keysApi.testWebhook", () => {
    beforeEach(() => mockOk({ success: true, status: 200 }));

    it("sends POST to /api/keys/test-webhook", async () => {
      await keysApi.testWebhook("https://example.com/hook");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/keys/test-webhook"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
