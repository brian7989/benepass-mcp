import {
  CLIENT_ID,
  COGNITO_IDP_HOST,
  COGNITO_IDP_URL,
  COGNITO_TOKEN_HOST,
  COGNITO_TOKEN_URL,
  USER_AGENT,
} from "../benepass/constants.js";

function assertHost(url: string, expected: string): URL {
  const parsed = new URL(url);
  if (parsed.hostname !== expected) {
    throw new Error(`Refused request to disallowed host: ${parsed.hostname}`);
  }
  return parsed;
}

async function cognitoIdp(
  target: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = assertHost(COGNITO_IDP_URL, COGNITO_IDP_HOST);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": target,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Cognito IDP returned non-JSON (HTTP ${String(res.status)})`);
  }
  if (!res.ok) {
    throw new Error(`Cognito IDP request failed (HTTP ${String(res.status)})`);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Cognito IDP returned an unexpected payload");
  }
  return parsed as Record<string, unknown>;
}
export async function initiateCustomAuth(email: string): Promise<{
  challenge_name: string;
  challenge_session: string;
}> {
  const data = await cognitoIdp("AWSCognitoIdentityProviderService.InitiateAuth", {
    AuthFlow: "CUSTOM_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: email },
  });
  const challengeName = data.ChallengeName;
  const challengeSession = data.Session;
  if (typeof challengeName !== "string" || typeof challengeSession !== "string") {
    throw new Error("Cognito did not return a login challenge");
  }
  return { challenge_name: challengeName, challenge_session: challengeSession };
}

export async function respondToAuthChallenge(
  email: string,
  otp: string,
  challengeSession: string,
): Promise<string> {
  const data = await cognitoIdp("AWSCognitoIdentityProviderService.RespondToAuthChallenge", {
    ChallengeName: "CUSTOM_CHALLENGE",
    ClientId: CLIENT_ID,
    Session: challengeSession,
    ChallengeResponses: {
      USERNAME: email,
      ANSWER: otp,
    },
  });
  const authResult = data.AuthenticationResult;
  if (typeof authResult !== "object" || authResult === null) {
    throw new Error("Login failed: no authentication result");
  }
  const refreshToken = (authResult as Record<string, unknown>).RefreshToken;
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    throw new Error("Login failed: Cognito did not return a session");
  }
  return refreshToken;
}
let cachedAccessToken: string | undefined;
let cachedForRefresh: string | undefined;

export function clearAccessTokenCache(): void {
  cachedAccessToken = undefined;
  cachedForRefresh = undefined;
}

export async function exchangeRefreshToken(refreshToken: string, force = false): Promise<string> {
  if (!force && cachedAccessToken && cachedForRefresh === refreshToken) {
    return cachedAccessToken;
  }
  const url = assertHost(COGNITO_TOKEN_URL, COGNITO_TOKEN_HOST);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body,
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Token endpoint returned non-JSON (HTTP ${String(res.status)})`);
  }
  if (!res.ok) {
    clearAccessTokenCache();
    throw new Error(`Token refresh failed (HTTP ${String(res.status)})`);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Token endpoint returned an unexpected payload");
  }
  const access = (parsed as Record<string, unknown>).access_token;
  if (typeof access !== "string" || access.length === 0) {
    throw new Error("Token endpoint did not return an access token");
  }
  cachedAccessToken = access;
  cachedForRefresh = refreshToken;
  return access;
}
