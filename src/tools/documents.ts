import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { apiGetJson } from "../benepass/client.js";
import { runTool } from "./result.js";

export function registerDocumentTools(server: McpServer): void {
  server.registerTool(
    "list_documents",
    {
      description:
        "List documents available in the current workspace (statements, plan docs, tax forms).",
      inputSchema: z.object({
        workspace_id: z.string().min(1).optional().describe("Workspace id override"),
      }),
    },
    async (args) =>
      runTool(async () => {
        const options = args.workspace_id !== undefined ? { workspaceId: args.workspace_id } : {};
        return apiGetJson("/v2/me/documents/", options);
      }),
  );

  server.registerTool(
    "get_document",
    {
      description: "Fetch a single document by id.",
      inputSchema: z.object({
        document_id: z.string().min(1).describe("Document id from list_documents"),
        workspace_id: z.string().min(1).optional().describe("Workspace id override"),
      }),
    },
    async (args) =>
      runTool(async () => {
        const options = args.workspace_id !== undefined ? { workspaceId: args.workspace_id } : {};
        return apiGetJson(`/v2/me/documents/${args.document_id}/`, options);
      }),
  );
}
