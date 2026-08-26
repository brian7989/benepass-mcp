import { AccessTokenCache } from "../src/cognito.js";
import { createBenepassApi } from "../src/api.js";
import { createApiHttp, createHttp } from "../src/http.js";
import { sessionStoreFor, withTempConfig } from "./helpers.js";

describe("HTTP client", () => {
  it("throws on non-GET methods without calling fetch", async () => {
    const fetchMock = vi.fn();
    const api = createApiHttp(createHttp(fetchMock));
    await expect(api.post("v2/me/")).rejects.toThrow(/non-GET/i);
    await expect(api.put("v2/me/accounts/")).rejects.toThrow(/non-GET/i);
    await expect(api.patch("v2/me/accounts/")).rejects.toThrow(/non-GET/i);
    await expect(api.delete("v2/me/documents/1/")).rejects.toThrow(/non-GET/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("BenepassApi.request refuses POST without calling fetch", async () => {
    await withTempConfig(async (dir) => {
      const fetchMock = vi.fn();
      const api = createBenepassApi({
        session: sessionStoreFor(dir),
        tokens: new AccessTokenCache(),
        fetch: fetchMock,
      });
      await expect(api.request("POST", "/v2/me/")).rejects.toThrow(/non-GET/i);
      await expect(api.request("PUT", "/v2/me/")).rejects.toThrow(/non-GET/i);
      await expect(api.request("PATCH", "/v2/me/")).rejects.toThrow(/non-GET/i);
      await expect(api.request("DELETE", "/v2/me/")).rejects.toThrow(/non-GET/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("host allowlist rejects other hosts without calling fetch", async () => {
    const fetchMock = vi.fn();
    const http = createHttp(fetchMock);
    await expect(http.get("https://evil.example.com/secret")).rejects.toThrow(
      /disallowed host: evil.example.com/i,
    );
    await expect(http.get("https://api.benepass.com/v2/me/")).rejects.toThrow(/disallowed host/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("host allowlist permits Benepass and Cognito hosts", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const http = createHttp(fetchMock);
    await http.get("https://api.benefitsapi.com/v2/me/");
    await http.get("https://cognito.benefitsapi.com/oauth2/token");
    await http.get("https://cognito-idp.us-east-1.amazonaws.com/");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
