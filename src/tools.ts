import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { App } from "./app.js";
import { PATHS, documentPath } from "./constants.js";
import { runTool } from "./result.js";
import {
  AuthStatusOutputSchema,
  CompleteLoginOutputSchema,
  HsaInvestmentsOutputSchema,
  JsonObjectSchema,
  ListPayloadSchema,
  LogoutOutputSchema,
  StartLoginOutputSchema,
  workspaceIdField,
  workspaceInputSchema,
} from "./schemas.js";

export const TOOL_NAMES = [
  "start_login",
  "complete_login",
  "auth_status",
  "logout",
  "list_workspaces",
  "list_accounts",
  "list_benefits",
  "list_transactions",
  "get_hsa_account_details",
  "get_hsa_investments",
  "list_documents",
  "get_document",
  "get_current_user",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const FORBIDDEN_TOOL_SUBSTR = [
  "deposit",
  "withdraw",
  "submit",
  "update",
  "delete",
  "payout",
  "call_api",
  "upload",
  "pin",
  "order",
] as const;

const readOnly = { readOnlyHint: true } as const;

export function registerTools(server: McpServer, app: App): void {
  server.registerTool(
    "start_login",
    {
      title: "Start login",
      description:
        "Start Benepass email OTP login. Sends a one-time code to the email and returns a short-lived challenge session.",
      annotations: readOnly,
      inputSchema: z.object({
        email: z.string().email().describe("Benepass account email"),
      }),
      outputSchema: StartLoginOutputSchema,
    },
    async ({ email }) => runTool(async () => app.cognito.initiateCustomAuth(email)),
  );

  server.registerTool(
    "complete_login",
    {
      title: "Complete login",
      description:
        "Complete Benepass login with the email OTP and challenge session from start_login. Persists a local session; never returns tokens.",
      annotations: readOnly,
      inputSchema: z.object({
        email: z.string().email().describe("Benepass account email"),
        otp: z.string().min(1).describe("One-time passcode from email"),
        challenge_session: z.string().min(1).describe("Session string from start_login"),
      }),
      outputSchema: CompleteLoginOutputSchema,
    },
    async (args) => runTool(async () => app.completeLogin(args)),
  );

  server.registerTool(
    "auth_status",
    {
      title: "Auth status",
      description:
        "Show whether a local Benepass session exists, and the logged-in email. Never returns secrets.",
      annotations: readOnly,
      outputSchema: AuthStatusOutputSchema,
    },
    async () =>
      runTool(async () => {
        const session = await app.session.load();
        if (!session) {
          return { logged_in: false as const };
        }
        return { logged_in: true as const, email: session.email };
      }),
  );

  server.registerTool(
    "logout",
    {
      title: "Log out",
      description: "Delete the local Benepass session file.",
      annotations: readOnly,
      outputSchema: LogoutOutputSchema,
    },
    async () =>
      runTool(async () => {
        app.tokens.clear();
        await app.session.clear();
        return { ok: true as const };
      }),
  );

  server.registerTool(
    "list_workspaces",
    {
      title: "List workspaces",
      description:
        "List Benepass workspaces for the logged-in user (employment and personal). Does not require a workspace header.",
      annotations: readOnly,
      outputSchema: JsonObjectSchema,
    },
    async () =>
      runTool(async () => app.api.getJson(PATHS.workspaces, { skipWorkspaceHeader: true })),
  );

  server.registerTool(
    "list_accounts",
    {
      title: "List accounts",
      description: "List benefit accounts and balances for the current workspace.",
      annotations: readOnly,
      inputSchema: workspaceInputSchema,
      outputSchema: ListPayloadSchema,
    },
    async (args) =>
      runTool(async () => {
        const data = await app.listAccounts(args.workspace_id);
        return { data };
      }),
  );

  server.registerTool(
    "list_benefits",
    {
      title: "List benefits",
      description:
        "List enrolled benefits derived from accounts (Benepass has no /v2/me/benefits/ endpoint). Includes available balance.",
      annotations: readOnly,
      inputSchema: workspaceInputSchema,
      outputSchema: ListPayloadSchema,
    },
    async (args) => runTool(async () => app.listBenefits(args.workspace_id)),
  );

  server.registerTool(
    "list_transactions",
    {
      title: "List transactions",
      description:
        "List transactions for the current workspace. Paginate with limit/offset; optionally filter by benefit_id.",
      annotations: readOnly,
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(20).describe("Page size (default 20)"),
        offset: z.number().int().min(0).default(0).describe("Offset for pagination (default 0)"),
        benefit_id: z.string().min(1).optional().describe("Filter by benefit id"),
        workspace_id: workspaceIdField,
      }),
      outputSchema: JsonObjectSchema,
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
        return app.api.getJson(PATHS.transactions, options);
      }),
  );

  server.registerTool(
    "get_hsa_account_details",
    {
      title: "Get HSA account details",
      description: "Fetch Health Savings Account details (US HSA). May 404 for non-US users.",
      annotations: readOnly,
      inputSchema: workspaceInputSchema,
      outputSchema: JsonObjectSchema,
    },
    async (args) =>
      runTool(async () => {
        const options = args.workspace_id !== undefined ? { workspaceId: args.workspace_id } : {};
        return app.api.getJson(PATHS.hsaAccountDetails, options);
      }),
  );

  server.registerTool(
    "get_hsa_investments",
    {
      title: "Get HSA investments",
      description:
        "Read HSA investment data by trying known GET paths on an HSA account. First 2xx wins. Reverse-engineered; paths may 404.",
      annotations: readOnly,
      inputSchema: z.object({
        account_id: z
          .string()
          .min(1)
          .optional()
          .describe("HSA account id; otherwise inferred from list_accounts"),
        workspace_id: workspaceIdField,
      }),
      outputSchema: HsaInvestmentsOutputSchema,
    },
    async (args) => runTool(async () => app.getHsaInvestments(args)),
  );

  server.registerTool(
    "list_documents",
    {
      title: "List documents",
      description:
        "List documents available in the current workspace (statements, plan docs, tax forms).",
      annotations: readOnly,
      inputSchema: workspaceInputSchema,
      outputSchema: JsonObjectSchema,
    },
    async (args) =>
      runTool(async () => {
        const options = args.workspace_id !== undefined ? { workspaceId: args.workspace_id } : {};
        return app.api.getJson(PATHS.documents, options);
      }),
  );

  server.registerTool(
    "get_document",
    {
      title: "Get document",
      description: "Fetch a single document by id.",
      annotations: readOnly,
      inputSchema: z.object({
        document_id: z.string().min(1).describe("Document id from list_documents"),
        workspace_id: workspaceIdField,
      }),
      outputSchema: JsonObjectSchema,
    },
    async (args) =>
      runTool(async () => {
        const options = args.workspace_id !== undefined ? { workspaceId: args.workspace_id } : {};
        return app.api.getJson(documentPath(args.document_id), options);
      }),
  );

  server.registerTool(
    "get_current_user",
    {
      title: "Get current user",
      description: "Fetch the current Benepass user profile (GET /v2/me/).",
      annotations: readOnly,
      outputSchema: JsonObjectSchema,
    },
    async () => runTool(async () => app.api.getJson(PATHS.me, { skipWorkspaceHeader: true })),
  );
}
