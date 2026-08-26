import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { apiGetJson } from "../benepass/client.js";
import { runTool } from "./result.js";

export function registerTransactionTools(server: McpServer): void {
  server.registerTool(
    "list_transactions",
    {
      description:
        "List transactions for the current workspace. Paginate with limit/offset; optionally filter by benefit_id.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(20).describe("Page size (default 20)"),
        offset: z.number().int().min(0).default(0).describe("Offset for pagination (default 0)"),
        benefit_id: z.string().min(1).optional().describe("Filter by benefit id"),
        workspace_id: z.string().min(1).optional().describe("Workspace id override"),
      }),
    },
    async (args) =>
      runTool(async () => {
        const query: Record<string, string | number> = {
          limit: args.limit,
          offset: args.offset,
        };
        if (args.benefit_id !== undefined) {
          query.benefit = args.benefit_id;
        }
        const options =
          args.workspace_id !== undefined ? { query, workspaceId: args.workspace_id } : { query };
        return apiGetJson("/v2/me/transactions/", options);
      }),
  );
}
