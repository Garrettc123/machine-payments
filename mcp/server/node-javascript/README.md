# Monetized MCP server - JavaScript

This is the JavaScript implementation of a monetized MCP catalog sample using MPP and Stripe Shared Payment Tokens.

## Requirements

- Node.js 20+
- [pnpm](https://pnpm.io/) package manager
- `make`
- Stripe account with Machine Payments enabled
- A Stripe profile ID for Shared Payment Tokens

## Setup

1. Configure environment variables:

```bash
cp ../../../.env.template .env
# Edit .env with your credentials:
# - STRIPE_SECRET_KEY
# - STRIPE_PROFILE_ID (from your Stripe profile)
# - BASE_URL=http://localhost:4242
```

2. Install dependencies:

```bash
make install
```

## Run the payment endpoint

```bash
make run
```

## Install the MCP server

Install the server in your agent of choice. See Stripe's [MCP server configuration guidance](https://docs.stripe.com/agentic-commerce/monetize-mcp#add-your-mcp-server) for client-specific instructions.

For example, in Claude Code:

```bash
claude mcp add --scope local paid-catalog -- \
  node --env-file="$(pwd)/.env" \
  "$(pwd)/mcp.js"
```

## Test the sample

Ask an MCP-enabled agent:

```text
Use the create_purchase_link tool from the paid-catalog MCP to purchase one coffee for Alice at test@example.com. This is a test flow; use test mode when creating the Link spend request.
```

The agent receives an `/api/purchase` URL, obtains an MPP credential from the Link agent wallet, and posts it to complete the payment. The `coffee` item costs $5.00; `sticker` costs $2.00.

## Development commands

- `make lint` — run lint and formatting checks without changing files
- `make format` — apply automatic formatting fixes
- `make typecheck` — run JavaScript syntax validation
- `make test` — run the automated test suite
- `make ci` — run the full local CI sequence (`install`, `lint`, `typecheck`, and `test`)
