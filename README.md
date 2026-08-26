# benepass-mcp

Unofficial, **read-only** MCP server for the Benepass employee-web API.

This project is **not affiliated with, endorsed by, or supported by Benepass**. It reverse-engineers the public employee-web client. **Do not contact Benepass support** about this server, login issues, missing endpoints, or anything else related to this unofficial tool.

The package name on the public registry is already taken by unofficial domdomegg/benepass-mcp. This repo sets private: true and is **not published** there.

## Security model

- **Read-only.** The HTTP client for api.benefitsapi.com throws if the method is not GET. There are no tools for deposits, withdrawals, expense submit/update/delete, cards/PIN, payouts, or generic call_api.
- **Tokens stay on your machine.** After OTP login, the Cognito refresh token is stored at ~/.config/benepass-mcp/session.json (XDG), mode 0600. Tools never return refresh or access tokens. Tokens are never logged. Session files are gitignored.
- **Outbound hosts only:** cognito-idp.us-east-1.amazonaws.com, cognito.benefitsapi.com, api.benefitsapi.com.
- Cognito app client id 6l7jeu4r44kgndgeab4aot355m is a **public** client id (not a secret); it is baked into the employee-web app.

## Login flow

1. Call start_login with your Benepass email. Cognito InitiateAuth CUSTOM_AUTH sends an OTP.
2. Call complete_login with the email, OTP, and challenge_session. Cognito RespondToAuthChallenge CUSTOM_CHALLENGE yields a refresh token that is written to the local session file. The tool returns only {ok, email}.
3. Later API calls POST grant_type=refresh_token to the token URL and send the access token as Authorization: Bearer.
4. If workspace_id is omitted, GET /v2/me/workspaces/ and persist the first type=employment workspace.

## Tools

Auth: start_login, complete_login, auth_status, logout.

Reads: list_workspaces, list_accounts, list_benefits (derived from accounts enrollment.benefit + available balance), list_transactions, get_hsa_account_details, get_hsa_investments, list_documents, get_document, get_current_user.

list_benefits: Benepass has no /v2/me/benefits/. Benefits are derived from each account enrollment.benefit and the balance key ending in /available.

get_hsa_investments: tries GET only, first 2xx wins:

- /v2/me/accounts/{id}/hsa-investments/
- /v2/me/accounts/{id}/hsa-investments/portfolio/
- /v2/me/accounts/{id}/hsa-investments/portfolio/allocation/
- /v2/me/accounts/{id}/hsa-investments/asset-links/

If account_id is omitted, accounts that look like HSA/investment are selected. If every candidate 404s, the tool errors and includes get_hsa_account_details. Those investment GET paths are reverse-engineered and may not exist for every account.

## Run over stdio

Node 24+, pnpm 10.14.0.

  pnpm install
  pnpm build
  node dist/index.js

Dev:

  pnpm dev

or:

  pnpm exec tsx src/index.ts

stdout is the MCP protocol. Logs go to stderr only.

## Cursor MCP config

Add to Cursor MCP settings (mcp.json). Point command at this repo after install:

```json
{
  "mcpServers": {
    "benepass": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/benepass-mcp/dist/index.js"]
    }
  }
}
```

Without a build step:

```json
{
  "mcpServers": {
    "benepass": {
      "command": "pnpm",
      "args": ["--dir", "/ABSOLUTE/PATH/TO/benepass-mcp", "exec", "tsx", "src/index.ts"]
    }
  }
}
```

Then: start_login - complete_login with the emailed OTP.

## License

MIT
