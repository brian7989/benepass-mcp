export const CLIENT_ID = "6l7jeu4r44kgndgeab4aot355m";
export const COGNITO_REGION = "us-east-1";
export const COGNITO_IDP_HOST = "cognito-idp.us-east-1.amazonaws.com";
export const COGNITO_IDP_URL = "https://cognito-idp.us-east-1.amazonaws.com/";
export const COGNITO_TOKEN_HOST = "cognito.benefitsapi.com";
export const COGNITO_TOKEN_URL = "https://cognito.benefitsapi.com/oauth2/token";
export const API_HOST = "api.benefitsapi.com";
export const API_BASE_URL = "https://api.benefitsapi.com";
export const USER_AGENT = "benepass-mcp (https://github.com/brian7989/benepass-mcp)";

export const ALLOWED_HOSTS = new Set([COGNITO_IDP_HOST, COGNITO_TOKEN_HOST, API_HOST]);

export const PATHS = {
  me: "/v2/me/",
  workspaces: "/v2/me/workspaces/",
  accounts: "/v2/me/accounts/",
  transactions: "/v2/me/transactions/",
  hsaAccountDetails: "/v2/me/hsa-account-details/",
  documents: "/v2/me/documents/",
} as const;

/** Single list of HSA investment GET candidates. `{id}` is replaced with encodeURIComponent(accountId). */
export const HSA_INVESTMENT_PATHS = [
  "/v2/me/accounts/{id}/hsa-investments/",
  "/v2/me/accounts/{id}/hsa-investments/portfolio/",
  "/v2/me/accounts/{id}/hsa-investments/portfolio/allocation/",
  "/v2/me/accounts/{id}/hsa-investments/asset-links/",
] as const;

export function hsaInvestmentPaths(accountId: string): string[] {
  const id = encodeURIComponent(accountId);
  return HSA_INVESTMENT_PATHS.map((template) => template.replaceAll("{id}", id));
}

export function documentPath(documentId: string): string {
  return `${PATHS.documents}${encodeURIComponent(documentId)}/`;
}
