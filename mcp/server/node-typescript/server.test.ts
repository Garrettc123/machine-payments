import type { Hono } from "hono";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
vi.stubEnv("STRIPE_PROFILE_ID", "profile_test_123");
vi.stubEnv("BASE_URL", "http://localhost:4242");

vi.mock("@hono/node-server", () => ({ serve: vi.fn() }));
vi.mock("stripe", () => {
  function StripeMock() {
    return {};
  }

  return { default: vi.fn().mockImplementation(StripeMock) };
});
vi.mock("mppx/server", () => {
  const handler = vi.fn().mockResolvedValue({
    status: 200,
    withReceipt: (response: Response) => response,
  });

  return {
    Mppx: { create: vi.fn().mockReturnValue({ compose: vi.fn(() => handler) }) },
    stripe: { create: vi.fn().mockReturnValue({ spt: { charge: vi.fn() } }) },
  };
});

let app: Hono;

beforeAll(async () => {
  ({ app } = await import("./server.js"));
});

describe("monetized MCP server", () => {
  it("serves the paid catalog over HTTP MCP", async () => {
    const response = await app.request("/mcp", {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2025-06-18",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: { tools: [{ name: "create_purchase_link" }] },
    });
  });

  it("accepts a valid purchase after the MPP payment flow", async () => {
    const response = await app.request(
      "/api/purchase?itemId=coffee&quantity=1&customerName=Alice&customerEmail=test@example.com",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it("rejects an invalid purchase before requesting payment", async () => {
    const response = await app.request("/api/purchase?itemId=missing&quantity=1");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("validates purchase details before requesting payment", async () => {
    const response = await app.request("/api/purchase?itemId=coffee&quantity=0");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid purchase request" });
  });
});
