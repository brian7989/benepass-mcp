import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { connectClient, mockCognito, sessionStoreFor, withTempConfig } from "./helpers.js";

const TOKEN_KEY =
  /refresh[_-]?token|access[_-]?token|id[_-]?token|AuthenticationResult|RefreshToken|AccessToken|IdToken/i;

describe("complete_login", () => {
  it("returns only ok and email; tool JSON has no token keys", async () => {
    await withTempConfig(async (dir) => {
      const { client, close } = await connectClient({
        cognito: mockCognito(),
        session: sessionStoreFor(dir),
      });
      try {
        const result = await client.callTool({
          name: "complete_login",
          arguments: {
            email: "user@example.com",
            otp: "123456",
            challenge_session: "challenge-session",
          },
        });
        const serialized = JSON.stringify(result);
        expect(serialized).not.toMatch(TOKEN_KEY);
        expect(serialized).not.toContain("secret-");
        expect(result.isError).toBeFalsy();
        const payload = result.structuredContent as { ok: boolean; email: string };
        expect(payload).toEqual({ ok: true, email: "user@example.com" });
        expect(Object.keys(payload).sort()).toEqual(["email", "ok"]);
        const sessionRaw = await readFile(path.join(dir, "benepass-mcp", "session.json"), "utf8");
        expect(JSON.parse(sessionRaw).refreshToken).toBe("secret-refresh-token-value");
      } finally {
        await close();
      }
    });
  });
});
