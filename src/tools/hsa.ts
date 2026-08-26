import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { apiGetJson, apiGetStatus, extractItems, isRecord } from "../benepass/client.js";
import { runTool } from "./result.js";

export const HSA_INVESTMENT_PATHS = [
  "/v2/me/accounts/{id}/hsa-investments/",
  "/v2/me/accounts/{id}/hsa-investments/portfolio/",
  "/v2/me/accounts/{id}/hsa-investments/portfolio/allocation/",
  "/v2/me/accounts/{id}/hsa-investments/asset-links/",
] as const;

export function hsaInvestmentPaths(accountId: string): string[] {
  return [
    `/v2/me/accounts/${accountId}/hsa-investments/`,
    `/v2/me/accounts/${accountId}/hsa-investments/portfolio/`,
    `/v2/me/accounts/${accountId}/hsa-investments/portfolio/allocation/`,
    `/v2/me/accounts/${accountId}/hsa-investments/asset-links/`,
  ];
}

function haystack(account: Record<string, unknown>): string {
  const enrollment = isRecord(account.enrollment) ? account.enrollment : undefined;
  const benefit = enrollment && isRecord(enrollment.benefit) ? enrollment.benefit : undefined;
  const parts = [
    account.key,
    account.id,
    account.type,
    account.account_type,
    account.name,
    benefit?.benefit_type,
    benefit?.name,
    benefit?.key,
  ];
  return parts
    .filter((part) => typeof part === "string")
    .join(" ")
    .toLowerCase();
}

export function looksLikeHsaOrInvestment(account: Record<string, unknown>): boolean {
  const text = haystack(account);
  return /\bhsa\b/.test(text) || text.includes("health savings") || text.includes("investment");
}
async function tryInvestmentPaths(
  accountId: string,
  workspaceId: string | undefined,
): Promise<
  | { account_id: string; path: string; body: unknown }
  | { account_id: string; errors: { path: string; status: number }[] }
> {
  const options = workspaceId !== undefined ? { workspaceId } : {};
  const errors: { path: string; status: number }[] = [];
  for (const path of hsaInvestmentPaths(accountId)) {
    const result = await apiGetStatus(path, options);
    if (result.status >= 200 && result.status < 300) {
      return { account_id: accountId, path, body: result.body };
    }
    errors.push({ path, status: result.status });
  }
  return { account_id: accountId, errors };
}

export async function getHsaInvestments(args: {
  account_id?: string | undefined;
  workspace_id?: string | undefined;
}): Promise<unknown> {
  const workspaceId = args.workspace_id;
  const options = workspaceId !== undefined ? { workspaceId } : {};
  let accountIds: string[] = [];
  if (args.account_id !== undefined) {
    accountIds = [args.account_id];
  } else {
    const accountsPayload = await apiGetJson("/v2/me/accounts/", options);
    const accounts = extractItems(accountsPayload);
    accountIds = accounts
      .filter(looksLikeHsaOrInvestment)
      .map((account) => account.id)
      .filter((id): id is string => typeof id === "string");
    if (accountIds.length === 0) {
      const details = await apiGetStatus("/v2/me/hsa-account-details/", options);
      throw new Error(
        JSON.stringify({
          error:
            "No HSA or investment-looking accounts were found. Tried no hsa-investments paths.",
          hsa_account_details: { status: details.status, body: details.body },
        }),
      );
    }
  }
  const attempts: { account_id: string; errors: { path: string; status: number }[] }[] = [];
  for (const accountId of accountIds) {
    const result = await tryInvestmentPaths(accountId, workspaceId);
    if ("body" in result) {
      return result;
    }
    attempts.push(result);
  }
  const details = await apiGetStatus("/v2/me/hsa-account-details/", options);
  throw new Error(
    JSON.stringify({
      error:
        "All HSA investment GET candidates returned non-2xx (often 404). Paths are reverse-engineered and may not exist for this account.",
      attempts,
      hsa_account_details: { status: details.status, body: details.body },
    }),
  );
}
export function registerHsaTools(server: McpServer): void {
  server.registerTool(
    "get_hsa_account_details",
    {
      description: "Fetch Health Savings Account details (US HSA). May 404 for non-US users.",
      inputSchema: z.object({
        workspace_id: z.string().min(1).optional().describe("Workspace id override"),
      }),
    },
    async (args) =>
      runTool(async () => {
        const options = args.workspace_id !== undefined ? { workspaceId: args.workspace_id } : {};
        return apiGetJson("/v2/me/hsa-account-details/", options);
      }),
  );

  server.registerTool(
    "get_hsa_investments",
    {
      description:
        "Read HSA investment data by trying known GET paths on an HSA account. First 2xx wins. Reverse-engineered; paths may 404.",
      inputSchema: z.object({
        account_id: z
          .string()
          .min(1)
          .optional()
          .describe("HSA account id; otherwise inferred from list_accounts"),
        workspace_id: z.string().min(1).optional().describe("Workspace id override"),
      }),
    },
    async (args) => runTool(async () => getHsaInvestments(args)),
  );
}
