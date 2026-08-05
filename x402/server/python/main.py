import os
import sys
from typing import Any, cast

import stripe
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from x402.http import FacilitatorConfig, HTTPFacilitatorClient, PaymentOption
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.http.types import RouteConfig
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.server import x402ResourceServer

load_dotenv()

# Don't put any keys in code. Use an environment variable (as shown
# here) or secrets vault to supply keys to your integration.
#
# See https://docs.stripe.com/keys-best-practices and find your
# keys at https://dashboard.stripe.com/apikeys.
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
if not STRIPE_SECRET_KEY:
    print("STRIPE_SECRET_KEY environment variable is required", file=sys.stderr)
    raise SystemExit(1)

DEPOSIT_ADDRESS = os.getenv("DEPOSIT_ADDRESS")
if not DEPOSIT_ADDRESS:
    print("DEPOSIT_ADDRESS environment variable is required", file=sys.stderr)
    print(
        "Create one with: stripe post /v1/crypto/deposit_addresses"
        " --live --stripe-version 2026-05-27.preview -d network=base",
        file=sys.stderr,
    )
    raise SystemExit(1)

FACILITATOR_URL = os.getenv("FACILITATOR_URL")
if not FACILITATOR_URL:
    print("FACILITATOR_URL environment variable is required", file=sys.stderr)
    raise SystemExit(1)

# Stripe deposit address created via the Stripe CLI:
# stripe post /v1/crypto/deposit_addresses --live \
#   --stripe-version 2026-05-27.preview -d network=base
DEPOSIT_ADDRESS = DEPOSIT_ADDRESS.lower()

stripe.api_key = STRIPE_SECRET_KEY
stripe.api_version = "2026-05-27.preview"  # type: ignore[assignment]
stripe.set_app_info(
    "stripe-samples/machine-payments",
    url="https://github.com/stripe-samples/machine-payments",
    version="1.0.0",
)

facilitator = HTTPFacilitatorClient(FacilitatorConfig(url=FACILITATOR_URL))

server = x402ResourceServer(facilitator)
server.register("eip155:84532", ExactEvmServerScheme())  # type: ignore[arg-type]


# Record settled on-chain payments as Stripe PaymentIntents
# using transaction_verification mode.
async def record_payment(context) -> None:
    result = context.result
    requirements = context.requirements

    tx_hash = result.transaction
    if not tx_hash or not result.success:
        return

    # requirements.amount is in atomic USDC units (6 decimals).
    # $0.01 = 10000 atomic units. Convert to cents for Stripe.
    amount_in_cents = round(int(requirements.amount) / 10000)
    if amount_in_cents < 1:
        return

    pi = stripe.PaymentIntent.create(
        amount=amount_in_cents,
        currency="usd",
        confirm=True,
        payment_method_data={"type": "crypto"},
        payment_method_types=["crypto"],
        payment_method_options=cast(
            Any,
            {
                "crypto": {
                    "mode": "transaction_verification",
                    "transaction_verification_options": {
                        "network": "base",
                        "transaction_hash": tx_hash,
                    },
                }
            },
        ),
        idempotency_key=tx_hash,
    )

    print(f"Stripe PI {pi.id}: {amount_in_cents}¢ on base for tx {tx_hash}")


server.on_after_settle(record_payment)

routes = {
    "GET /paid": RouteConfig(
        accepts=[
            PaymentOption(
                scheme="exact",
                price="$0.01",
                network="eip155:84532",
                pay_to=DEPOSIT_ADDRESS,
            )
        ],
        description="Data retrieval endpoint",
        mime_type="application/json",
    )
}

app = FastAPI(title="x402 REST API")

app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)


@app.get("/paid")
async def get_paid():
    return {"foo": "bar"}


if __name__ == "__main__":
    print("Server listening at http://localhost:4242")
    uvicorn.run(app, host="0.0.0.0", port=4242)
