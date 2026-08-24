import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "dotenv";
import { z } from "zod";
import { getItem, validatePurchase } from "./catalog.js";

config({ quiet: true });

const server = new McpServer({ name: "paid-catalog", version: "1.0.0" });

server.registerTool(
  "create_purchase_link",
  {
    description:
      "Returns a payment link for a one-time purchase. " +
      "POST to the link with an MPP credential to pay automatically, " +
      "or open it in a browser to pay with a card.",
    inputSchema: {
      itemId: z.string(),
      quantity: z.number().int().positive(),
      customerName: z.string(),
      customerEmail: z.string(),
    },
  },
  async ({ itemId, quantity, customerName, customerEmail }) => {
    const params = new URLSearchParams({
      itemId,
      quantity: String(quantity),
      customerName,
      customerEmail,
    });
    const paymentLink = `${process.env.BASE_URL}/api/purchase?${params}`;

    // Do your normal business logic.
    const item = getItem(itemId);
    if (!item) throw new Error("Item not found");
    if (!validatePurchase({ item, quantity, customerName, customerEmail })) {
      throw new Error("Invalid purchase request");
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              // This link must be MPP enabled.
              paymentLink,
              instructions: {
                agent: `Use \`npx @stripe/link-cli mpp pay ${paymentLink}\` to pay with a Shared Payment Token for networkId "${process.env.STRIPE_PROFILE_ID}". Include a \`--context\` argument describing the purchase (minimum 100 characters), and add \`--test\` if this is a test-mode flow.`,
                browser: "Open paymentLink in a browser to pay with a card.",
              },
              item: {
                title: item.title,
                quantity,
                price: `${(item.priceCents / 100).toFixed(2)} USD`,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

await server.connect(new StdioServerTransport());
