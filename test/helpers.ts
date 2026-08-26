import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { clearAccessTokenCache } from "../src/benepass/client.js";

export async function withTempConfig<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "benepass-mcp-"));
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;
  clearAccessTokenCache();
  try {
    return await fn(dir);
  } finally {
    clearAccessTokenCache();
    if (previous === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previous;
    }
    await rm(dir, { recursive: true, force: true });
  }
}

export async function writeSession(dir: string, email = "user@example.com"): Promise<void> {
  const folder = path.join(dir, "benepass-mcp");
  await mkdir(folder, { recursive: true });
  await writeFile(
    path.join(folder, "session.json"),
    JSON.stringify({ email, refreshToken: "test-refresh-token", workspaceId: "ws_1" }, null, 2),
    { mode: 0o600 },
  );
}
