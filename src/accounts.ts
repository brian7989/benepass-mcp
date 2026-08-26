import { PATHS } from "./constants.js";
import type { ApiGetOptions, BenepassApi } from "./api.js";
import {
  type Account,
  type Balance,
  type DerivedBenefit,
  AccountSchema,
  parseItems,
} from "./schemas.js";

const HSA_TYPE_VALUES = new Set(["hsa", "health_savings", "health_savings_account"]);

function normalizeType(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Select HSA accounts from Zod-parsed fields only: enrollment.benefit.benefit_type,
 * enrollment.benefit.key, account.key, account.account_type, account.type.
 * Does not search account names.
 */
export function isHsaAccount(account: Account): boolean {
  const fields = [
    account.enrollment?.benefit?.benefit_type,
    account.enrollment?.benefit?.key,
    account.key,
    account.account_type,
    account.type,
  ];
  for (const field of fields) {
    if (field !== undefined && HSA_TYPE_VALUES.has(normalizeType(field))) {
      return true;
    }
  }
  return false;
}

export function availableBalance(balances: Balance[] | undefined): Balance | undefined {
  if (balances === undefined) {
    return undefined;
  }
  const matches = balances.filter(
    (item) => item.key === "available" || item.key.endsWith("/available"),
  );
  const primary = matches.find(
    (item) => !item.key.includes("reimbursement") && !item.key.includes("payout"),
  );
  return primary ?? matches[0];
}

export function deriveBenefits(accounts: Account[]): DerivedBenefit[] {
  const benefits: DerivedBenefit[] = [];
  for (const account of accounts) {
    const enrollment = account.enrollment;
    const benefit = enrollment?.benefit;
    if (benefit === undefined) {
      continue;
    }
    const available = availableBalance(account.balances);
    benefits.push({
      id: benefit.id,
      name: benefit.name ?? null,
      benefit_type: benefit.benefit_type ?? null,
      account_id: account.id,
      available_balance: available?.amount ?? null,
      formatted_available_balance: available?.formatted_local_amount ?? null,
      max_per_expense:
        enrollment?.local_max_expense_amount ?? enrollment?.max_expense_amount ?? null,
    });
  }
  return benefits;
}

export async function listAccounts(
  api: BenepassApi,
  options: ApiGetOptions = {},
): Promise<Account[]> {
  const payload = await api.getJson(PATHS.accounts, options);
  return parseItems(AccountSchema, payload, "accounts");
}

export async function listBenefits(
  api: BenepassApi,
  options: ApiGetOptions = {},
): Promise<{ data: DerivedBenefit[] }> {
  const accounts = await listAccounts(api, options);
  return { data: deriveBenefits(accounts) };
}
