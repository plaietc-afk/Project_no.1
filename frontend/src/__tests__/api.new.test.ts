import { describe, it, expect, vi, afterEach } from "vitest";
import { statsApi, usersApi } from "../lib/api";

function mockOk(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => body })
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("statsApi new functions", () => {
  describe("statsApi.byKey", () => {
    it("calls /api/stats/by-key with default days", async () => {
      mockOk({ success: true, data: [] });
      await statsApi.byKey();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/stats/by-key?days=30"),
        expect.any(Object)
      );
    });

    it("passes user_id when provided", async () => {
      mockOk({ success: true, data: [] });
      await statsApi.byKey(7, 42);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("user_id=42"),
        expect.any(Object)
      );
    });
  });

  describe("statsApi.byUser", () => {
    it("calls /api/stats/by-user with default days", async () => {
      mockOk({ success: true, data: [] });
      await statsApi.byUser();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/stats/by-user?days=30"),
        expect.any(Object)
      );
    });

    it("calls with custom days", async () => {
      mockOk({ success: true, data: [] });
      await statsApi.byUser(14);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("days=14"),
        expect.any(Object)
      );
    });
  });

  describe("statsApi.latency", () => {
    it("calls /api/stats/latency with default days", async () => {
      mockOk({ success: true, data: [] });
      await statsApi.latency();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/stats/latency?days=30"),
        expect.any(Object)
      );
    });

    it("passes user_id when provided", async () => {
      mockOk({ success: true, data: [] });
      await statsApi.latency(30, 5);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("user_id=5"),
        expect.any(Object)
      );
    });
  });

  describe("statsApi.costComparisonClasses", () => {
    it("calls /api/stats/cost-comparison/classes", async () => {
      mockOk({ success: true, data: [] });
      await statsApi.costComparisonClasses();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/stats/cost-comparison/classes"),
        expect.any(Object)
      );
    });
  });

  describe("statsApi.costComparison", () => {
    it("calls /api/stats/cost-comparison with all params", async () => {
      mockOk({ success: true, data: [], meta: {} });
      await statsApi.costComparison(1000000, 300000, "standard");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/stats/cost-comparison"),
        expect.any(Object)
      );
      const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain("prompt_tokens=1000000");
      expect(url).toContain("completion_tokens=300000");
      expect(url).toContain("model_class=standard");
    });
  });
});

describe("usersApi", () => {
  describe("usersApi.list", () => {
    it("calls GET /api/users", async () => {
      mockOk({ success: true, data: [] });
      await usersApi.list();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/users"),
        expect.any(Object)
      );
    });
  });

  describe("usersApi.create", () => {
    it("sends POST to /api/users with display_name", async () => {
      mockOk({ success: true, data: {} });
      await usersApi.create("Alice");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/users"),
        expect.objectContaining({ method: "POST" })
      );
      const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
      expect(body.display_name).toBe("Alice");
    });
  });

  describe("usersApi.update", () => {
    it("sends PUT to /api/users/:id with display_name", async () => {
      mockOk({ success: true, data: {} });
      await usersApi.update(3, "Bob");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/users/3"),
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  describe("usersApi.remove", () => {
    it("sends DELETE to /api/users/:id", async () => {
      mockOk({ success: true, message: "ok" });
      await usersApi.remove(7);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/users/7"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
