import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { apiGetJson, extractItems, isRecord } from "../benepass/client.js";
import { runTool } from "./result.js";

const workspaceInput = z.object({
  workspace_id: z
    .string()
    .min(1)
    .optional()
    .describe("Workspace id; defaults to the first employment workspace"),
});

function findAvailableBalance(balances: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(balances)) {
    return undefined;
  }
  const matches = balances.filter(isRecord).filter((item) => {
    const key = item.key;
    return typeof key === "string" && (key === "available" || key.endsWith("/available"));
  });
  const primary = matches.find((item) => {
    const key = String(item.key ?? "");
    return !key.includes("reimbursement") && !key.includes("payout");
  });
  return primary ?? matches[0];
}

function deriveBenefits(accountsPayload: unknown): unknown[] {
  const accounts = extractItems(accountsPayload);
  const benefits: unknown[] = [];
  for (const account of accounts) {
    const enrollment = isRecord(account.enrollment) ? account.enrollment : undefined;
    const benefit = enrollment && isRecord(enrollment.benefit) ? enrollment.benefit : undefined;
    if (!benefit || typeof benefit.id !== "string") {
      continue;
    }
    const available = findAvailableBalance(account.balances);
    benefits.push({
      id: benefit.id,
      name: benefit.name ?? null,
      benefit_type: benefit.benefit_type ?? null,
      account_id: account.id ?? null,
      available_balance: available?.amount ?? null,
      formatted_available_balance: available?.formatted_local_amount ?? null,
      max_per_expense:
        enrollment?.local_max_expense_amount ?? enrollment?.max_expense_amount ?? null,
    });
  }
  return benefits;
}
export function registerAccountTools(server: McpServer): void {
  server.registerTool(
    "list_accounts",
    {
      description: "List benefit accounts and balances for the current workspace.",
      inputSchema: workspaceInput,
    },
    async (args) =>
      runTool(async () => {
        const options = args.workspace_id !== undefined ? { workspaceId: args.workspace_id } : {};
        return apiGetJson("/v2/me/accounts/", options);
      }),
  );

  server.registerTool(
    "list_benefits",
    {
      description:
        "List enrolled benefits derived from accounts (Benepass has no /v2/me/benefits/ endpoint). Includes available balance.",
      inputSchema: workspaceInput,
    },
    async (args) =>
      runTool(async () => {
        const options = args.workspace_id !== undefined ? { workspaceId: args.workspace_id } : {};
        const accounts = await apiGetJson("/v2/me/accounts/", options);
        return { data: deriveBenefits(accounts) };
      }),
  );
}
