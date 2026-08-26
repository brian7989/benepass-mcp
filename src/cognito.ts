import {
  AuthFlowType,
  ChallengeNameType,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import * as z from "zod";
import {
  CLIENT_ID,
  COGNITO_IDP_URL,
  COGNITO_REGION,
  COGNITO_TOKEN_URL,
  USER_AGENT,
} from "./constants.js";
import { AuthenticationError } from "./errors.js";
import { type KyInstance, isHTTPError } from "./http.js";
import { JwtPayloadSchema, TokenResponseSchema } from "./schemas.js";

export type LoginChallenge = {
  challenge_name: string;
  challenge_session: string;
};

export type CognitoAuth = {
  initiateCustomAuth(email: string): Promise<LoginChallenge>;
  respondToAuthChallenge(email: string, otp: string, challengeSession: string): Promise<string>;
};

const InitiateSchema = z.object({
  ChallengeName: z.string(),
  Session: z.string(),
});

const RespondSchema = z.object({
  AuthenticationResult: z.object({
    RefreshToken: z.string().min(1),
  }),
});

const TOKEN_SKEW_MS = 30_000;
const DEFAULT_TTL_MS = 50 * 60 * 1000;

export function createCognitoClient(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({
    region: COGNITO_REGION,
    endpoint: COGNITO_IDP_URL,
    credentials: {
      accessKeyId: "anonymous",
      secretAccessKey: "anonymous",
    },
    customUserAgent: USER_AGENT,
  });
}

function wrapCognito(err: unknown): AuthenticationError {
  if (err instanceof AuthenticationError) {
    return err;
  }
  const message = err instanceof Error ? err.message : "Cognito request failed";
  return new AuthenticationError(message);
}

export function createCognitoAuth(
  client: CognitoIdentityProviderClient = createCognitoClient(),
): CognitoAuth {
  return {
    async initiateCustomAuth(email) {
      try {
        const out = await client.send(
          new InitiateAuthCommand({
            AuthFlow: AuthFlowType.CUSTOM_AUTH,
            ClientId: CLIENT_ID,
            AuthParameters: { USERNAME: email },
          }),
        );
        const parsed = InitiateSchema.safeParse(out);
        if (!parsed.success) {
          throw new AuthenticationError("Cognito did not return a login challenge");
        }
        return {
          challenge_name: parsed.data.ChallengeName,
          challenge_session: parsed.data.Session,
        };
      } catch (err) {
        throw wrapCognito(err);
      }
    },

    async respondToAuthChallenge(email, otp, challengeSession) {
      try {
        const out = await client.send(
          new RespondToAuthChallengeCommand({
            ChallengeName: ChallengeNameType.CUSTOM_CHALLENGE,
            ClientId: CLIENT_ID,
            Session: challengeSession,
            ChallengeResponses: {
              USERNAME: email,
              ANSWER: otp,
            },
          }),
        );
        const parsed = RespondSchema.safeParse(out);
        if (!parsed.success) {
          throw new AuthenticationError("Login failed: Cognito did not return a session");
        }
        return parsed.data.AuthenticationResult.RefreshToken;
      } catch (err) {
        throw wrapCognito(err);
      }
    },
  };
}

function jwtExpiresAtMs(accessToken: string): number | undefined {
  const payload = accessToken.split(".")[1];
  if (payload === undefined) {
    return undefined;
  }
  try {
    const json: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const parsed = JwtPayloadSchema.safeParse(json);
    if (!parsed.success || parsed.data.exp === undefined) {
      return undefined;
    }
    return parsed.data.exp * 1000;
  } catch {
    return undefined;
  }
}

function expiresAtMs(accessToken: string, expiresIn: number | undefined): number {
  const now = Date.now();
  const fromExpiresIn = expiresIn !== undefined ? now + expiresIn * 1000 : undefined;
  const fromJwt = jwtExpiresAtMs(accessToken);
  const candidates = [fromExpiresIn, fromJwt].filter(
    (value): value is number => value !== undefined,
  );
  const raw = candidates.length > 0 ? Math.min(...candidates) : now + DEFAULT_TTL_MS;
  return raw - TOKEN_SKEW_MS;
}

type CachedAccess = {
  refreshToken: string;
  accessToken: string;
  expiresAt: number;
};

export class AccessTokenCache {
  private cached: CachedAccess | undefined;

  clear(): void {
    this.cached = undefined;
  }

  async get(refreshToken: string, http: KyInstance, force = false): Promise<string> {
    const now = Date.now();
    if (
      !force &&
      this.cached !== undefined &&
      this.cached.refreshToken === refreshToken &&
      this.cached.expiresAt > now
    ) {
      return this.cached.accessToken;
    }
    const issued = await exchangeRefreshToken(refreshToken, http);
    this.cached = issued;
    return issued.accessToken;
  }
}

async function exchangeRefreshToken(refreshToken: string, http: KyInstance): Promise<CachedAccess> {
  try {
    const raw: unknown = await http
      .post(COGNITO_TOKEN_URL, {
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: CLIENT_ID,
          refresh_token: refreshToken,
        }),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      })
      .json();
    const parsed = TokenResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AuthenticationError("Token endpoint did not return an access token");
    }
    return {
      refreshToken,
      accessToken: parsed.data.access_token,
      expiresAt: expiresAtMs(parsed.data.access_token, parsed.data.expires_in),
    };
  } catch (err) {
    if (err instanceof AuthenticationError) {
      throw err;
    }
    if (isHTTPError(err)) {
      throw new AuthenticationError(`Token refresh failed (HTTP ${String(err.response.status)})`);
    }
    const message = err instanceof Error ? err.message : "Token refresh failed";
    throw new AuthenticationError(message);
  }
}
