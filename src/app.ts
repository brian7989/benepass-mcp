import { listAccounts, listBenefits } from "./accounts.js";
import { type BenepassApi, createBenepassApi } from "./api.js";
import { type CognitoAuth, AccessTokenCache, createCognitoAuth } from "./cognito.js";
import { PATHS, documentPath } from "./constants.js";
import { getHsaInvestments } from "./hsa.js";
import type { FetchLike } from "./http.js";
import { type SessionStore, createSessionStore } from "./session.js";

export type ServerDeps = {
  fetch?: FetchLike;
  session?: SessionStore;
  cognito?: CognitoAuth;
};

export type App = {
  session: SessionStore;
  cognito: CognitoAuth;
  tokens: AccessTokenCache;
  api: BenepassApi;
  completeLogin(args: {
    email: string;
    otp: string;
    challenge_session: string;
  }): Promise<{ ok: true; email: string }>;
  listAccounts(workspaceId?: string): ReturnType<typeof listAccounts>;
  listBenefits(workspaceId?: string): ReturnType<typeof listBenefits>;
  getHsaInvestments(args: {
    account_id?: string | undefined;
    workspace_id?: string | undefined;
  }): ReturnType<typeof getHsaInvestments>;
};

function apiOptions(workspaceId: string | undefined) {
  return workspaceId !== undefined ? { workspaceId } : {};
}

export function createApp(deps: ServerDeps = {}): App {
  const session = deps.session ?? createSessionStore();
  const tokens = new AccessTokenCache();
  const cognito = deps.cognito ?? createCognitoAuth();
  const api = createBenepassApi(
    deps.fetch === undefined ? { session, tokens } : { session, tokens, fetch: deps.fetch },
  );

  return {
    session,
    cognito,
    tokens,
    api,
    async completeLogin(args) {
      const refreshToken = await cognito.respondToAuthChallenge(
        args.email,
        args.otp,
        args.challenge_session,
      );
      tokens.clear();
      await session.save({ email: args.email, refreshToken });
      return { ok: true, email: args.email };
    },
    listAccounts(workspaceId) {
      return listAccounts(api, apiOptions(workspaceId));
    },
    listBenefits(workspaceId) {
      return listBenefits(api, apiOptions(workspaceId));
    },
    getHsaInvestments(args) {
      return getHsaInvestments(api, args);
    },
  };
}

export { PATHS, documentPath };
