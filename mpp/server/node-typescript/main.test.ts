import type { Hono } from "hono";
import { beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ discovery: vi.fn() }));

// Stub env vars before importing the app
vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
vi.stubEnv("TEMPO_DEPOSIT_ADDRESS", "0xtest_deposit_address");
vi.stubEnv("STRIPE_PROFILE_ID", "profile_test_123");

// Mock @hono/node-server so `serve()` is a no-op
vi.mock("@hono/node-server", () => ({
  serve: vi.fn(),
}));

vi.mock("mppx/hono", () => ({
  discovery: mocks.discovery,
}));

// Mock process.exit to prevent it from killing the test runner
vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

// Mock stripe so we don't hit the real API
vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(
      class {
        paymentIntents = {
          create: vi.fn().mockResolvedValue({
            id: "pi_test_123",
            status: "succeeded",
          }),
        };
      },
    ),
  };
});

// Mock mppx so we don't need real payment infra
vi.mock("mppx/server", () => {
  const chargeHandler = vi.fn().mockResolvedValue({
    status: 200,
    withReceipt: (res: Response) => res,
  });
  const mockInstance = {
    charge: vi.fn().mockReturnValue(chargeHandler),
  };
  return {
    Mppx: {
      create: vi.fn().mockReturnValue(mockInstance),
    },
    stripe: {
      create: vi.fn().mockReturnValue({
        defaultMethods: vi.fn().mockReturnValue([]),
      }),
    },
  };
});

let app: Hono;

beforeAll(async () => {
  const mod = await import("./main.ts");
  app = mod.app;
});

describe("mpp server", () => {
  it("exports a Hono app", () => {
    expect(app).toBeDefined();
    expect(app.fetch).toBeInstanceOf(Function);
  });

  it("POST /paid returns 402 or 200 depending on mppx charge flow", async () => {
    const res = await app.request("/paid", { method: "POST" });
    expect([200, 402]).toContain(res.status);
  });

  it("describes the optional POST body in OpenAPI discovery", async () => {
    const config = mocks.discovery.mock.calls[0]?.[2] as {
      routes: Array<{ requestBody?: unknown }>;
    };
    expect(config.routes[0]?.requestBody).toEqual({
      required: false,
      content: { "application/json": { schema: { type: "object" } } },
      description: "Optional JSON request data.",
    });
  });
});
