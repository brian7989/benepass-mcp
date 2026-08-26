# benepass-mcp

Unofficial, **read-only** MCP server for the Benepass employee-web API.

This project is **not affiliated with, endorsed by, or supported by Benepass**. It reverse-engineers the public employee-web client. **Do not contact Benepass support** about this server, login issues, missing endpoints, or anything else related to this unofficial tool.

The package name on the public registry is already taken. This repo sets `private: true` and is **not published** there.

## Layout

- `src/index.ts` — stdio entry (`serveStdio`)
- `src/server.ts` — `McpServer` factory
- `src/tools.ts` — thin MCP adapters (`TOOL_NAMES`)
- `src/app.ts` — composition root
- `src/accounts.ts` — benefits derivation, HSA account selection
- `src/hsa.ts` — investment GET path walk
- `src/api.ts` — GET-only Benepass HTTP client
- `src/http.ts` — ky + host allowlist
- `src/cognito.ts` — Cognito OTP + token refresh
- `src/session.ts` — local session file
- `src/schemas.ts` — Zod models for Benepass JSON
- `src/errors.ts` — typed errors
- `test/` — Vitest (in-process MCP client + unit tests)

## Security model

- **Read-only.** The ky client for `api.benefitsapi.com` throws if the method is not GET. There are no tools for deposits, withdrawals, expense submit/update/delete, cards/PIN, payouts, or generic `call_api`.
- **Tokens stay on your machine.** After OTP login, the Cognito refresh token is stored at `~/.config/benepass-mcp/session.json` (XDG via `env-paths`), mode `0600`. Override with `BENEPASS_SESSION_PATH` (two P's). Tools never return refresh or access tokens. Tokens are never logged. Session files are gitignored.
- **Outbound hosts only:** `cognito-idp.us-east-1.amazonaws.com`, `cognito.benefitsapi.com`, `api.benefitsapi.com`.
- Cognito app client id `6l7jeu4r44kgndgeab4aot355m` is a **public** client id (not a secret); it is baked into the employee-web app.

## Login flow

1. Call `start_login` with your Benepass email. Cognito InitiateAuth CUSTOM_AUTH sends an OTP.
2. Call `complete_login` with the email, OTP, and `challenge_session`. Cognito RespondToAuthChallenge CUSTOM_CHALLENGE yields a refresh token that is written to the local session file. The tool returns only `{ ok, email }`.
3. Later API calls POST `grant_type=refresh_token` to the token URL and send the access token as Authorization Bearer. Expiry is honored (`expires_in` and JWT `exp`).
4. If `workspace_id` is omitted, GET `/v2/me/workspaces/` and persist the first `type=employment` workspace.

## Tools

Auth: `start_login`, `complete_login`, `auth_status`, `logout`.

Reads: `list_workspaces`, `list_accounts`, `list_benefits` (derived from accounts `enrollment.benefit` + available balance), `list_transactions`, `get_hsa_account_details`, `get_hsa_investments`, `list_documents`, `get_document`, `get_current_user`.

`list_benefits`: Benepass has no `/v2/me/benefits/`. Benefits are derived from each account `enrollment.benefit` and the balance key ending in `/available`.

`get_hsa_investments`: tries GET only, first 2xx wins:

- `/v2/me/accounts/{id}/hsa-investments/`
- `/v2/me/accounts/{id}/hsa-investments/portfolio/`
- `/v2/me/accounts/{id}/hsa-investments/portfolio/allocation/`
- `/v2/me/accounts/{id}/hsa-investments/asset-links/`

If `account_id` is omitted, HSA accounts are selected from Zod-parsed fields (`enrollment.benefit.benefit_type`, `enrollment.benefit.key`, `account.key`, `account.account_type`, `account.type`) matching `hsa` / `health_savings` / `health_savings_account`. Account names are not searched. If those fields are absent, the tool falls back to an account id on GET `/v2/me/hsa-account-details/`. If every candidate 404s, the tool errors and includes that `get_hsa_account_details` payload. Those investment GET paths are reverse-engineered and may not exist for every account.

## License

MIT

## Stdio

This server speaks MCP on stdout and writes logs to stderr. Use the `start` script after `build`, or the `dev` script during development.

## Cursor

Add a `benepass` entry to MCP settings (`mcp.json`) that launches this package's compiled entry. Authenticate with `start_login` then `complete_login`.

Example Cursor config is in `cursor-mcp.example.json`.
