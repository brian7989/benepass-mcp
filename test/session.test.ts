import { chmod, stat } from "node:fs/promises";
import * as path from "node:path";
import envPaths from "env-paths";
import { sessionFilePath } from "../src/session.js";
import { sessionStoreFor, withTempConfig } from "./helpers.js";

describe("session store", () => {
  it("defaults to env-paths config/session.json", async () => {
    await withTempConfig(async () => {
      const paths = envPaths("benepass-mcp", { suffix: "" });
      expect(sessionFilePath()).toBe(path.join(paths.config, "session.json"));
    });
  });

  it("honors BENEPASS_SESSION_PATH override", async () => {
    await withTempConfig(async (dir) => {
      const override = path.join(dir, "custom", "session.json");
      process.env.BENEPASS_SESSION_PATH = override;
      expect(sessionFilePath()).toBe(override);
    });
  });

  it("roundtrips email and refresh token with mode 0600", async () => {
    await withTempConfig(async (dir) => {
      const store = sessionStoreFor(dir);
      await store.save({
        email: "user@example.com",
        refreshToken: "rt_secret",
        workspaceId: "ws_1",
      });
      const file = store.path();
      const mode = (await stat(file)).mode & 0o777;
      expect(mode).toBe(0o600);
      const loaded = await store.load();
      expect(loaded).toEqual({
        email: "user@example.com",
        refreshToken: "rt_secret",
        workspaceId: "ws_1",
      });
    });
  });

  it("rejects a session file missing refreshToken", async () => {
    await withTempConfig(async (dir) => {
      const store = sessionStoreFor(dir);
      const file = store.path();
      const { mkdir, writeFile } = await import("node:fs/promises");
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify({ email: "user@example.com" }));
      await expect(store.load()).rejects.toThrow(/invalid/i);
    });
  });

  it("chmod 0600 even if umask was looser after write", async () => {
    await withTempConfig(async (dir) => {
      const store = sessionStoreFor(dir);
      await store.save({ email: "user@example.com", refreshToken: "rt" });
      const file = store.path();
      await chmod(file, 0o644);
      await store.save({ email: "user@example.com", refreshToken: "rt" });
      const mode = (await stat(file)).mode & 0o777;
      expect(mode).toBe(0o600);
      expect(dir).toBeTruthy();
    });
  });
});
