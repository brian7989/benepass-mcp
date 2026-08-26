import { PATHS, hsaInvestmentPaths } from "./constants.js";
import { isHsaAccount, listAccounts } from "./accounts.js";
import type { ApiGetOptions, BenepassApi } from "./api.js";
import { HsaInvestmentsNotFoundError, type HsaAttempt } from "./errors.js";
import { HsaAccountDetailsSchema } from "./schemas.js";

export { hsaInvestmentPaths } from "./constants.js";
export { HSA_INVESTMENT_PATHS } from "./constants.js";

function optionsOf(workspaceId: string | undefined): ApiGetOptions {
  return workspaceId !== undefined ? { workspaceId } : {};
}

function accountIdFromDetails(body: unknown): string | undefined {
  const parsed = HsaAccountDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data.account_id ?? parsed.data.account?.id ?? parsed.data.id;
}

async function tryInvestmentPaths(
  api: BenepassApi,
  accountId: string,
  workspaceId: string | undefined,
): Promise<
  | { account_id: string; path: string; body: unknown }
  | { account_id: string; errors: { path: string; status: number }[] }
> {
  const options = optionsOf(workspaceId);
  const errors: { path: string; status: number }[] = [];
  for (const path of hsaInvestmentPaths(accountId)) {
    const result = await api.getStatus(path, options);
    if (result.status >= 200 && result.status < 300) {
      return { account_id: accountId, path, body: result.body };
    }
    errors.push({ path, status: result.status });
  }
  return { account_id: accountId, errors };
}

async function resolveAccountIds(
  api: BenepassApi,
  accountId: string | undefined,
  workspaceId: string | undefined,
): Promise<{ ids: string[]; details: { status: number; body: unknown } | undefined }> {
  if (accountId !== undefined) {
    return { ids: [accountId], details: undefined };
  }
  const options = optionsOf(workspaceId);
  const accounts = await listAccounts(api, options);
  const matched = accounts.filter(isHsaAccount).map((account) => account.id);
  if (matched.length > 0) {
    return { ids: matched, details: undefined };
  }
  const details = await api.getStatus(PATHS.hsaAccountDetails, options);
  const fallbackId = accountIdFromDetails(details.body);
  if (fallbackId !== undefined && fallbackId.length > 0) {
    return { ids: [fallbackId], details };
  }
  throw new HsaInvestmentsNotFoundError(
    "No HSA account found from enrollment.benefit.benefit_type/key or account type. Pass account_id. Fallback get_hsa_account_details also lacked an account id.",
    [],
    { status: details.status, body: details.body },
  );
}

export async function getHsaInvestments(
  api: BenepassApi,
  args: { account_id?: string | undefined; workspace_id?: string | undefined },
): Promise<{ account_id: string; path: string; body: unknown }> {
  const workspaceId = args.workspace_id;
  const { ids, details: prefetched } = await resolveAccountIds(api, args.account_id, workspaceId);
  const attempts: HsaAttempt[] = [];
  for (const id of ids) {
    const result = await tryInvestmentPaths(api, id, workspaceId);
    if ("body" in result) {
      return result;
    }
    for (const error of result.errors) {
      attempts.push({ account_id: id, path: error.path, status: error.status });
    }
  }
  const options = optionsOf(workspaceId);
  const details = prefetched ?? (await api.getStatus(PATHS.hsaAccountDetails, options));
  throw new HsaInvestmentsNotFoundError(
    "All HSA investment GET candidates returned non-2xx (often 404). Paths are reverse-engineered and may not exist for this account.",
    attempts,
    { status: details.status, body: details.body },
  );
}
