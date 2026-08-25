# Monetized MCP server - TypeScript

This is the TypeScript implementation of a monetized MCP catalog sample using MPP and Stripe Shared Payment Tokens.

## Requirements

- Node.js 20+
- [pnpm](https://pnpm.io/) package manager
- `make`
- Stripe account with Machine Payments enabled
- A Stripe profile ID for Shared Payment Tokens
- [Link CLI](https://www.npmjs.com/package/@stripe/link-cli) (`npx @stripe/link-cli`) for test Shared Payment Tokens

## Setup

1. Configure environment variables:

```bash
cp ../../../.env.template .env
# Edit .env with your credentials:
# - STRIPE_SECRET_KEY
# - STRIPE_PROFILE_ID (from your Stripe profile)
# - BASE_URL=http://localhost:4242
# - PORT=4242
```

2. Install dependencies:

```bash
make install
```

## Run the server

```bash
make run
```

This starts the MCP endpoint at `http://localhost:4242/mcp` and the payment endpoint at `http://localhost:4242/api/purchase`.

## Connect the MCP server

Connect the HTTP MCP server to your agent of choice. See Stripe's [MCP server configuration guidance](https://docs.stripe.com/agentic-commerce/monetize-mcp#add-your-mcp-server) for client-specific instructions.

For example, in Claude Code:

```bash
claude mcp add --transport http paid-catalog http://localhost:4242/mcp
```

## Test the sample

Ask an MCP-enabled agent:

```text
Use the create_purchase_link tool from the paid-catalog MCP to purchase one item with the ID `coffee` for Alice at test@example.com. This flow uses test mode, so it doesn't move real funds.
```

The agent calls the HTTP MCP tool, receives an `/api/purchase` URL, uses the Link CLI to obtain an MPP credential, and posts it to complete the payment. The `coffee` item costs $5.00; `sticker` costs $2.00. If you open the URL in your browser, it will redirect to a placeholder checkout page.

## Development commands

- `make lint` — run lint and formatting checks without changing files
- `make format` — apply automatic formatting fixes
- `make typecheck` — run TypeScript type checking
- `make test` — run the automated test suite
- `make ci` — run the full local CI sequence (`install`, `lint`, `typecheck`, and `test`)
