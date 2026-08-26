import { createApp } from "../src/app.js";
import { hsaInvestmentPaths } from "../src/hsa.js";
import { jsonResponse, sessionStoreFor, withTempConfig, writeSession } from "./helpers.js";

type Call = { method: string; url: string };

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function requestMethod(input: string | URL | Request, init?: RequestInit): string {
  if (input instanceof Request) {
    return input.method.toUpperCase();
  }
  return (init?.method ?? "GET").toUpperCase();
}

describe("get_hsa_investments", () => {
  it("only issues GET to the candidate investment paths", async () => {
    await withTempConfig(async (dir) => {
      await writeSession(dir);
      const calls: Call[] = [];
      const accountId = "acc_hsa_1";
      const candidates = hsaInvestmentPaths(accountId);
      const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = requestUrl(input);
        const method = requestMethod(input, init);
        calls.push({ method, url });
        if (url.includes("/oauth2/token")) {
          return jsonResponse(200, {
            access_token: "test-access",
            token_type: "Bearer",
            expires_in: 3600,
          });
        }
        const parsed = new URL(url);
        if (parsed.pathname === candidates[0]) {
          return jsonResponse(200, { data: [{ id: "inv_1" }] });
        }
        return jsonResponse(404, { detail: "not found" });
      });
      const app = createApp({ fetch: fetchMock, session: sessionStoreFor(dir) });
      const result = await app.getHsaInvestments({ account_id: accountId });
      expect(result).toMatchObject({ account_id: accountId, path: candidates[0] });
      const apiCalls = calls.filter((call) => call.url.includes("api.benefitsapi.com"));
      expect(apiCalls.length).toBeGreaterThan(0);
      for (const call of apiCalls) {
        expect(call.method).toBe("GET");
        const pathname = new URL(call.url).pathname;
        expect(candidates).toContain(pathname);
      }
      expect(apiCalls.some((call) => new URL(call.url).pathname === candidates[0])).toBe(true);
    });
  });

  it("walks remaining GET candidates when earlier paths 404", async () => {
    await withTempConfig(async (dir) => {
      await writeSession(dir);
      const calls: Call[] = [];
      const accountId = "acc_hsa_2";
      const candidates = hsaInvestmentPaths(accountId);
      const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = requestUrl(input);
        const method = requestMethod(input, init);
        calls.push({ method, url });
        if (url.includes("/oauth2/token")) {
          return jsonResponse(200, {
            access_token: "test-access",
            token_type: "Bearer",
            expires_in: 3600,
          });
        }
        const pathname = new URL(url).pathname;
        if (pathname === candidates[3]) {
          return jsonResponse(200, { data: [] });
        }
        return jsonResponse(404, { detail: "not found" });
      });
      const app = createApp({ fetch: fetchMock, session: sessionStoreFor(dir) });
      const result = await app.getHsaInvestments({ account_id: accountId });
      expect(result.path).toBe(candidates[3]);
      const investmentCalls = calls.filter((call) => call.url.includes("hsa-investments"));
      expect(investmentCalls).toHaveLength(4);
      for (const call of investmentCalls) {
        expect(call.method).toBe("GET");
        expect(candidates).toContain(new URL(call.url).pathname);
      }
    });
  });
});
