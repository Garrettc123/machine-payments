import { serve } from "@hono/node-server";
import crypto from "crypto";
import { config } from "dotenv";
import { Hono } from "hono";
import { Mppx, stripe as mppStripe } from "mppx/server";
import Stripe from "stripe";
import { completeOrder, getItem, validatePurchase } from "./catalog.js";
import { handleMcpRequest } from "./mcp.js";

config();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}

if (!process.env.STRIPE_PROFILE_ID) {
  throw new Error("STRIPE_PROFILE_ID environment variable is required");
}

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
  appInfo: {
    name: "stripe-samples/machine-payments",
    url: "https://github.com/stripe-samples/machine-payments",
    version: "1.0.0",
  },
});

// Secret used to secure payment challenges.
// https://mpp.dev/protocol/challenges#challenge-binding
const mppSecretKey = crypto
  .createHmac("sha256", process.env.STRIPE_SECRET_KEY)
  .update("mpp-challenge-signing")
  .digest("base64");

const stripeMachinePayments = mppStripe.create({
  client: stripeClient,
  networkId: process.env.STRIPE_PROFILE_ID,
  livemode: !process.env.STRIPE_SECRET_KEY.includes("_test_"),
});

const mppx = Mppx.create({
  methods: [stripeMachinePayments.spt.charge()],
  secretKey: mppSecretKey,
});

// GET or POST /api/purchase?itemId=...&quantity=...
async function handler(request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  // Browser redirect — replace the placeholder route with your checkout flow.
  const accept = request.headers.get("Accept") ?? "";
  if (accept.includes("text/html")) {
    return Response.redirect(
      new URL(`/checkout/${params.get("itemId")}?${params}`, process.env.BASE_URL),
    );
  }

  // Agent/programmatic path — MPP 402-challenge flow.
  const item = getItem(params.get("itemId"));
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });
  const quantity = Number(params.get("quantity"));
  const customerName = params.get("customerName");
  const customerEmail = params.get("customerEmail");

  if (!validatePurchase({ item, quantity, customerName, customerEmail })) {
    return Response.json({ error: "Invalid purchase request" }, { status: 400 });
  }

  const result = await mppx.compose([
    "stripe/charge",
    {
      amount: ((item.priceCents * quantity) / 100).toFixed(2),
      currency: "usd",
      decimals: 2,
      description: item.title,
    },
  ])(request);

  if (result.status === 402) return result.challenge;

  // Payment confirmed — run your business logic.
  const order = completeOrder({ item, quantity, customerName, customerEmail });
  return result.withReceipt(Response.json({ success: true, orderId: order.id }));
}

const app = new Hono();

app.post("/mcp", (context) => handleMcpRequest(context.req.raw));

app.on(["GET", "POST"], "/api/purchase", (context) => handler(context.req.raw));

app.get("/checkout/:itemId", (context) => {
  return context.text("Replace this route with the browser checkout flow for your application.");
});

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 4242) });
console.log(`Server listening at ${process.env.BASE_URL}`);

export { app };
