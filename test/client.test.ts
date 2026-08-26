import { apiRequest } from "../src/benepass/client.js";

describe("Benepass API client", () => {
  it("throws on non-GET methods without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiRequest("POST", "/v2/me/")).rejects.toThrow(/non-GET/i);
    await expect(apiRequest("PATCH", "/v2/me/accounts/")).rejects.toThrow(/non-GET/i);
    await expect(apiRequest("DELETE", "/v2/me/documents/1/")).rejects.toThrow(/non-GET/i);
    await expect(apiRequest("put", "/v2/me/")).rejects.toThrow(/non-GET/i);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
