import { beforeAll, describe, expect, it, vi } from "vitest";

vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
vi.stubEnv("STRIPE_PROFILE_ID", "profile_test_123");

vi.mock("@hono/node-server", () => ({ serve: vi.fn() }));
vi.mock("stripe", () => ({ default: vi.fn().mockImplementation(class {}) }));
vi.mock("mppx/server", () => {
  const handler = vi.fn().mockResolvedValue({
    status: 200,
    withReceipt: (response) => response,
  });

  return {
    Mppx: { create: vi.fn().mockReturnValue({ compose: vi.fn(() => handler) }) },
    stripe: { create: vi.fn().mockReturnValue({ spt: { charge: vi.fn() } }) },
  };
});

let app;

beforeAll(async () => {
  ({ app } = await import("./server.js"));
});

describe("monetized MCP payment endpoint", () => {
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
