import { PATHS } from "./constants.js";
import type { AccessTokenCache } from "./cognito.js";
import { ApiHttpError, SchemaError } from "./errors.js";
import { type FetchLike, type KyInstance, createApiHttp, createHttp, isHTTPError } from "./http.js";
import { WorkspaceSchema, parseItems } from "./schemas.js";
import type { SessionStore } from "./session.js";

export type ApiGetOptions = {
  query?: Record<string, string | number | undefined>;
  workspaceId?: string;
  skipWorkspaceHeader?: boolean;
};

function toRelative(path: string): string {
  return path.replace(/^\/+/, "");
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export class BenepassApi {
  readonly http: KyInstance;
  readonly apiHttp: KyInstance;
  readonly session: SessionStore;
  readonly tokens: AccessTokenCache;

  constructor(args: {
    session: SessionStore;
    tokens: AccessTokenCache;
    http: KyInstance;
    apiHttp: KyInstance;
  }) {
    this.session = args.session;
    this.tokens = args.tokens;
    this.http = args.http;
    this.apiHttp = args.apiHttp;
  }

  async request(method: string, path: string, options: ApiGetOptions = {}): Promise<Response> {
    const extra = method.toUpperCase() === "GET" ? await this.requestOptions(options) : {};
    return this.apiHttp(toRelative(path), { method, ...extra });
  }

  async getJson(path: string, options: ApiGetOptions = {}): Promise<unknown> {
    try {
      return await this.apiHttp.get(toRelative(path), await this.requestOptions(options)).json();
    } catch (err) {
      if (isHTTPError(err)) {
        throw new ApiHttpError(err.response.status, path, err.data);
      }
      throw err;
    }
  }

  async getStatus(
    path: string,
    options: ApiGetOptions = {},
  ): Promise<{ status: number; body: unknown }> {
    const response = await this.apiHttp.get(toRelative(path), {
      ...(await this.requestOptions(options)),
      throwHttpErrors: false,
    });
    return { status: response.status, body: await parseBody(response) };
  }

  private async requestOptions(options: ApiGetOptions): Promise<{
    headers: Record<string, string>;
    searchParams: Record<string, string | number>;
  }> {
    const headers: Record<string, string> = {};
    if (!options.skipWorkspaceHeader) {
      headers["x-benepass-workspace-id"] = await this.resolveWorkspaceId(options.workspaceId);
    }
    const searchParams: Record<string, string | number> = {};
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          searchParams[key] = value;
        }
      }
    }
    return { headers, searchParams };
  }

  private async resolveWorkspaceId(workspaceId: string | undefined): Promise<string> {
    if (workspaceId !== undefined) {
      await this.session.saveWorkspaceId(workspaceId);
      return workspaceId;
    }
    const session = await this.session.require();
    if (session.workspaceId !== undefined) {
      return session.workspaceId;
    }
    const payload = await this.getJson(PATHS.workspaces, { skipWorkspaceHeader: true });
    const workspaces = parseItems(WorkspaceSchema, payload, "workspaces");
    const employment = workspaces.find((item) => item.type === "employment") ?? workspaces[0];
    const id = employment?.id;
    if (id === undefined || id.length === 0) {
      throw new SchemaError("No Benepass workspace found. Call list_workspaces after login.");
    }
    await this.session.saveWorkspaceId(id);
    return id;
  }
}

export function createBenepassApi(args: {
  session: SessionStore;
  tokens: AccessTokenCache;
  fetch?: FetchLike;
}): BenepassApi {
  const http = createHttp(args.fetch);
  const tokens = args.tokens;
  const session = args.session;
  const apiHttp = createApiHttp(http).extend({
    hooks: {
      beforeRequest: [
        async ({ request }) => {
          const current = await session.require();
          const access = await tokens.get(current.refreshToken, http);
          request.headers.set("Authorization", `Bearer ${access}`);
        },
      ],
      beforeRetry: [
        async ({ request, error }) => {
          if (isHTTPError(error) && error.response.status === 401) {
            const current = await session.require();
            const access = await tokens.get(current.refreshToken, http, true);
            request.headers.set("Authorization", `Bearer ${access}`);
          }
        },
      ],
    },
  });
  return new BenepassApi({ session, tokens, http, apiHttp });
}
