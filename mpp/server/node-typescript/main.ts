import crypto from "node:crypto";
import { serve } from "@hono/node-server";
import { config } from "dotenv";
import { Hono } from "hono";
import { Mppx, stripe as mppStripe, tempo } from "mppx/server";
import Stripe from "stripe";

config();

// Don't put any keys in code. Use an environment variable (as shown
// here) or secrets vault to supply keys to your integration.
//
// See https://docs.stripe.com/keys-best-practices and find your
// keys at https://dashboard.stripe.com/apikeys.
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY environment variable is required");
  process.exit(1);
}

if (!process.env.DEPOSIT_ADDRESS) {
  console.error("DEPOSIT_ADDRESS environment variable is required");
  console.error(
    "Create one with: stripe post /v1/crypto/deposit_addresses --live --stripe-version 2026-05-27.preview -d network=tempo",
  );
  process.exit(1);
}

// USDC on Tempo (mainnet)
const TEMPO_USDC = "0x20c000000000000000000000b9537d11c60e8b50";

// Stripe deposit address created via:
// stripe post /v1/crypto/deposit_addresses --live --stripe-version 2026-05-27.preview -d network=tempo
const DEPOSIT_ADDRESS = process.env.DEPOSIT_ADDRESS as `0x${string}`;

// Secret used to secure payment challenges
// https://mpp.dev/protocol/challenges#challenge-binding
const mppSecretKey = crypto
  .createHmac("sha256", process.env.STRIPE_SECRET_KEY!)
  .update("mpp-challenge-signing")
  .digest("base64");

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // @ts-expect-error preview API version required for crypto PaymentIntents
  apiVersion: "2026-05-27.preview",
  appInfo: {
    name: "stripe-samples/machine-payments",
    url: "https://github.com/stripe-samples/machine-payments",
    version: "1.0.0",
  },
});

const app = new Hono();

const mppx = Mppx.create({
  methods: [
    tempo.charge({
      currency: TEMPO_USDC,
      recipient: DEPOSIT_ADDRESS,
      decimals: 2,
    }),
    mppStripe.charge({
      client: stripeClient,
      networkId: process.env.STRIPE_PROFILE_ID!,
      paymentMethodTypes: ["card", "link"],
      decimals: 2,
    }),
  ],
  secretKey: mppSecretKey,
});

// Record on-chain crypto payments as Stripe PaymentIntents using transaction_verification mode.
const SUPPORTED_NETWORKS = ["tempo"];

mppx.onPaymentSuccess(async ({ receipt, request }) => {
  const txHash = receipt.reference;
  if (!txHash || !SUPPORTED_NETWORKS.includes(receipt.method)) {
    return;
  }

  const amountInCents = Math.round(Number(request.amount) * 100);
  if (amountInCents < 1) {
    return;
  }

  const pi = await stripeClient.paymentIntents.create(
    {
      amount: amountInCents,
      currency: "usd",
      confirm: true,
      payment_method_data: { type: "crypto" },
      payment_method_types: ["crypto"],
      payment_method_options: {
        crypto: {
          mode: "transaction_verification",
          transaction_verification_options: {
            network: receipt.method,
            transaction_hash: txHash,
          },
        },
      },
    } as Stripe.PaymentIntentCreateParams,
    { idempotencyKey: txHash },
  );

  console.log(`Stripe PI ${pi.id}: ${amountInCents}¢ on ${receipt.method} for tx ${txHash}`);
});

app.get("/paid", async (c) => {
  const request = c.req.raw;

  const response = await Mppx.compose(
    mppx.tempo.charge({ amount: "0.01", recipient: DEPOSIT_ADDRESS }),
    mppx.stripe.charge({ amount: "0.50", currency: "usd" }),
  )(request);

  if (response.status === 402) return response.challenge;

  return response.withReceipt(Response.json({ foo: "bar" }));
});

serve({
  fetch: app.fetch,
  port: 4242,
});

console.log("Server listening at http://localhost:4242");

export { app };
