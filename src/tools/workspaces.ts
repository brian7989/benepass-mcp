import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { apiGetJson } from "../benepass/client.js";
import { runTool } from "./result.js";

export function registerWorkspaceTools(server: McpServer): void {
  server.registerTool(
    "list_workspaces",
    {
      description:
        "List Benepass workspaces for the logged-in user (employment and personal). Does not require a workspace header.",
      inputSchema: z.object({}),
    },
    async () =>
      runTool(async () => apiGetJson("/v2/me/workspaces/", { skipWorkspaceHeader: true })),
  );
}
