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
