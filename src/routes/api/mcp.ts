import { createFileRoute } from "@tanstack/react-router";
import { createMcpServer, withMcpAuth } from "mcp-tanstack-start";
import { listCustomersTool, customerStatsTool } from "@/lib/mcp/tools/customers";
import { customerDetailTool } from "@/lib/mcp/tools/customer-detail";
import { listOrdersTool, revenueSummaryTool } from "@/lib/mcp/tools/orders";
import { listSegmentsTool, rfmDistributionTool, marketingActionsTool } from "@/lib/mcp/tools/segments";
import { zendeskTicketsTool, integrationsStatusTool } from "@/lib/mcp/tools/support";

const mcp = createMcpServer({
  name: "easysea-mcp",
  version: "1.0.0",
  instructions:
    "MCP server per Easysea (brand nautico premium). Usa questi tool per rispondere a domande sui dati: clienti, ordini, segmenti RFM, community Circle, ticket Zendesk, azioni marketing, connettori. Rispondi sempre in italiano con numeri precisi.",
  tools: [
    listCustomersTool,
    customerStatsTool,
    customerDetailTool,
    listOrdersTool,
    revenueSummaryTool,
    listSegmentsTool,
    rfmDistributionTool,
    marketingActionsTool,
    zendeskTicketsTool,
    integrationsStatusTool,
  ],
});

const methodNotAllowed = () =>
  new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }),
    {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "POST, OPTIONS" },
    },
  );

const authenticatedHandler = withMcpAuth(
  async (request, auth) => mcp.handleRequest(request, { auth }),
  async (request) => {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    const secret = process.env.MCP_SECRET;
    if (!secret || !token || token !== secret) return null;
    return { token };
  },
);

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => authenticatedHandler(request),
      GET: async () => methodNotAllowed(),
      DELETE: async () => methodNotAllowed(),
    },
  },
});
