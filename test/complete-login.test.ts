import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { completeLogin } from "../src/tools/auth.js";
import { runTool } from "../src/tools/result.js";
import { withTempConfig } from "./helpers.js";

const TOKEN_KEY =
  /refresh[_-]?token|access[_-]?token|id[_-]?token|AuthenticationResult|RefreshToken|AccessToken|IdToken/i;

describe("complete_login", () => {
  it("returns only ok and email; tool JSON has no token keys", async () => {
    await withTempConfig(async (dir) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          return new Response(
            JSON.stringify({
              AuthenticationResult: {
                AccessToken: "secret-access-token-value",
                RefreshToken: "secret-refresh-token-value",
                IdToken: "secret-id-token-value",
                ExpiresIn: 3600,
                TokenType: "Bearer",
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }),
      );
      const result = await runTool(async () =>
        completeLogin({
          email: "user@example.com",
          otp: "123456",
          challenge_session: "challenge-session",
        }),
      );
      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(TOKEN_KEY);
      expect(serialized).not.toContain("secret-");
      const payload = JSON.parse(result.content[0].text) as { ok: boolean; email: string };
      expect(payload).toEqual({ ok: true, email: "user@example.com" });
      expect(Object.keys(payload).sort()).toEqual(["email", "ok"]);
      const sessionRaw = await readFile(path.join(dir, "benepass-mcp", "session.json"), "utf8");
      expect(JSON.parse(sessionRaw).refreshToken).toBe("secret-refresh-token-value");
      vi.unstubAllGlobals();
    });
  });
});
