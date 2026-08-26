import ky, { type KyInstance, isHTTPError } from "ky";
import { ALLOWED_HOSTS, API_BASE_URL, USER_AGENT } from "./constants.js";
import { HostNotAllowedError, MethodNotAllowedError } from "./errors.js";

export type FetchLike = typeof globalThis.fetch;

function hostnameOf(url: string): string {
  return new URL(url).hostname;
}

export function assertAllowedHost(url: string): void {
  const hostname = hostnameOf(url);
  if (!ALLOWED_HOSTS.has(hostname)) {
    throw new HostNotAllowedError(hostname);
  }
}

/**
 * Shared ky instance: User-Agent, timeout, injected fetch, host allowlist.
 * Token refresh POSTs go through this instance (not the GET-only API client).
 */
export function createHttp(fetchImpl: FetchLike = globalThis.fetch.bind(globalThis)): KyInstance {
  return ky.create({
    fetch: fetchImpl,
    timeout: 30_000,
    headers: { "user-agent": USER_AGENT },
    retry: { limit: 0 },
    hooks: {
      beforeRequest: [
        ({ request }) => {
          assertAllowedHost(request.url);
        },
      ],
    },
  });
}

/**
 * GET-only ky client for api.benefitsapi.com. Non-GET throws before fetch.
 */
export function createApiHttp(http: KyInstance): KyInstance {
  return http.extend({
    prefix: API_BASE_URL,
    headers: {
      accept: "application/json",
      "x-benepass-client": "employee-web",
      "x-benepass-platform": "web",
    },
    retry: {
      limit: 1,
      statusCodes: [401],
    },
    hooks: {
      beforeRequest: [
        ({ request }) => {
          if (request.method !== "GET") {
            throw new MethodNotAllowedError(request.method);
          }
        },
      ],
    },
  });
}

export { isHTTPError };
export type { KyInstance };
