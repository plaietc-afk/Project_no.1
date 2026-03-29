import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KeysTable } from "../components/KeysTable";
import type { ApiKey } from "../lib/api";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    keysApi: {
      ...actual.keysApi,
      rotate: vi.fn().mockResolvedValue({ api_key: "new-key", message: "ok" }),
      testWebhook: vi.fn().mockResolvedValue({ success: true, status: 200 }),
      revoke: vi.fn().mockResolvedValue({ success: true, message: "ok" }),
    },
  };
});

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 1,
    key_name: "test-key",
    provider: "openai",
    budget: 0,
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

describe("KeysTable drill-down integration", () => {
  it("clicking a key row calls onKeySelect with that key", () => {
    const onKeySelect = vi.fn();
    render(
      <KeysTable
        keys={[makeKey({ id: 5, key_name: "my-key" })]}
        loading={false}
        onRevoke={vi.fn()}
        onToast={vi.fn()}
        onRotated={vi.fn()}
        onKeySelect={onKeySelect}
      />
    );
    fireEvent.click(screen.getByText("my-key"));
    expect(onKeySelect).toHaveBeenCalledWith(expect.objectContaining({ id: 5, key_name: "my-key" }));
  });

  it("renders without onKeySelect prop (backwards compatibility)", () => {
    expect(() =>
      render(
        <KeysTable
          keys={[makeKey()]}
          loading={false}
          onRevoke={vi.fn()}
          onToast={vi.fn()}
          onRotated={vi.fn()}
        />
      )
    ).not.toThrow();
  });

  it("shows a visual cue (cursor-pointer) on key name when onKeySelect is provided", () => {
    render(
      <KeysTable
        keys={[makeKey({ key_name: "clickable-key" })]}
        loading={false}
        onRevoke={vi.fn()}
        onToast={vi.fn()}
        onRotated={vi.fn()}
        onKeySelect={vi.fn()}
      />
    );
    // The key name cell should have cursor-pointer styling
    const nameEl = screen.getByText("clickable-key");
    expect(nameEl.className).toMatch(/cursor-pointer/);
  });
});
