import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { getItem, validatePurchase } from "./catalog.js";

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "paid-catalog", version: "1.0.0" });

  server.registerTool(
    "create_purchase_link",
    {
      description:
        "Returns a payment link for a one-time purchase. " +
        "POST to the link with an MPP credential to pay automatically, " +
        "or open it in a browser to preview the browser checkout fallback.",
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
      const purchase = { item, quantity, customerName, customerEmail };
      if (!validatePurchase(purchase)) {
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
                  agent: `POST to paymentLink. Server returns 402 on first call — use link-cli to obtain an SPT for networkId "${process.env.STRIPE_NETWORK_ID}" and retry.`,
                  browser: "Open paymentLink in a browser to view the placeholder checkout page.",
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

  return server;
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}
