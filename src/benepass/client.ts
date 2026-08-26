import { clearAccessTokenCache, exchangeRefreshToken } from "../auth/cognito.js";
import { loadSession, requireSession, saveWorkspaceId } from "../auth/session.js";
import { API_BASE_URL, API_HOST, USER_AGENT } from "./constants.js";

export class ApiHttpError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body: unknown;

  constructor(status: number, path: string, body: unknown) {
    super(`Benepass API GET ${path} failed (HTTP ${String(status)})`);
    this.name = "ApiHttpError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export type ApiGetOptions = {
  query?: Record<string, string | number | undefined>;
  workspaceId?: string;
  skipWorkspaceHeader?: boolean;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractItems(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }
  if (isRecord(payload)) {
    const data = payload.data;
    if (Array.isArray(data)) {
      return data.filter(isRecord);
    }
    const results = payload.results;
    if (Array.isArray(results)) {
      return results.filter(isRecord);
    }
  }
  return [];
}

function assertGet(method: string): void {
  if (method.toUpperCase() !== "GET") {
    throw new Error(
      `Refusing non-GET request to Benepass API (${method}). This client is read-only.`,
    );
  }
}
function buildUrl(path: string, query?: Record<string, string | number | undefined>): URL {
  const url =
    path.startsWith("http://") || path.startsWith("https://")
      ? new URL(path)
      : new URL(path, API_BASE_URL);
  if (url.hostname !== API_HOST) {
    throw new Error(`Refused request to disallowed host: ${url.hostname}`);
  }
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url;
}

export async function apiRequest(
  method: string,
  path: string,
  options: ApiGetOptions = {},
): Promise<Response> {
  assertGet(method);
  return apiFetch(path, options);
}

async function resolveWorkspaceHeader(options: ApiGetOptions): Promise<string | undefined> {
  if (options.skipWorkspaceHeader) {
    return undefined;
  }
  if (options.workspaceId !== undefined) {
    await saveWorkspaceId(options.workspaceId);
    return options.workspaceId;
  }
  const session = await loadSession();
  if (session?.workspaceId) {
    return session.workspaceId;
  }
  const payload = await apiGetJson("/v2/me/workspaces/", { skipWorkspaceHeader: true });
  const workspaces = extractItems(payload);
  const employment = workspaces.find((item) => item.type === "employment") ?? workspaces[0];
  const id = employment?.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("No Benepass workspace found. Call list_workspaces after login.");
  }
  await saveWorkspaceId(id);
  return id;
}
async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function apiFetch(path: string, options: ApiGetOptions): Promise<Response> {
  const url = buildUrl(path, options.query);
  const session = await requireSession();
  const workspaceId = await resolveWorkspaceHeader(options);
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${await exchangeRefreshToken(session.refreshToken)}`,
    "User-Agent": USER_AGENT,
    "x-benepass-client": "employee-web",
    "x-benepass-platform": "web",
  };
  if (workspaceId !== undefined) {
    headers["x-benepass-workspace-id"] = workspaceId;
  }
  let res = await fetch(url, { method: "GET", headers });
  if (res.status === 401) {
    const token = await exchangeRefreshToken(session.refreshToken, true);
    headers.Authorization = `Bearer ${token}`;
    res = await fetch(url, { method: "GET", headers });
  }
  return res;
}

export async function apiGetJson(path: string, options: ApiGetOptions = {}): Promise<unknown> {
  const res = await apiRequest("GET", path, options);
  const body = await parseBody(res);
  if (!res.ok) {
    throw new ApiHttpError(res.status, path, body);
  }
  return body;
}

export async function apiGetStatus(
  path: string,
  options: ApiGetOptions = {},
): Promise<{ status: number; body: unknown }> {
  const res = await apiRequest("GET", path, options);
  const body = await parseBody(res);
  return { status: res.status, body };
}

export { clearAccessTokenCache };
