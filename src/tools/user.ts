import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { apiGetJson } from "../benepass/client.js";
import { runTool } from "./result.js";

export function registerUserTools(server: McpServer): void {
  server.registerTool(
    "get_current_user",
    {
      description: "Fetch the current Benepass user profile (GET /v2/me/).",
      inputSchema: z.object({}),
    },
    async () => runTool(async () => apiGetJson("/v2/me/", { skipWorkspaceHeader: true })),
  );
}
