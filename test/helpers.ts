import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { CognitoAuth } from "../src/cognito.js";
import { createServer, type ServerDeps } from "../src/server.js";
import { createSessionStore } from "../src/session.js";

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function withTempConfig<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "benepass-mcp-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;
  const previousSession = process.env.BENEPASS_SESSION_PATH;
  process.env.XDG_CONFIG_HOME = dir;
  delete process.env.BENEPASS_SESSION_PATH;
  try {
    return await fn(dir);
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
    if (previousSession === undefined) {
      delete process.env.BENEPASS_SESSION_PATH;
    } else {
      process.env.BENEPASS_SESSION_PATH = previousSession;
    }
    await rm(dir, { recursive: true, force: true });
  }
}

export async function writeSession(dir: string, email = "user@example.com"): Promise<string> {
  const folder = path.join(dir, "benepass-mcp");
  await mkdir(folder, { recursive: true });
  const file = path.join(folder, "session.json");
  await writeFile(
    file,
    JSON.stringify({ email, refreshToken: "test-refresh-token", workspaceId: "ws_1" }, null, 2),
    { mode: 0o600 },
  );
  return file;
}

export function mockCognito(refreshToken = "secret-refresh-token-value"): CognitoAuth {
  return {
    async initiateCustomAuth(email) {
      return {
        challenge_name: "CUSTOM_CHALLENGE",
        challenge_session: `challenge-for-${email}`,
      };
    },
    async respondToAuthChallenge() {
      return refreshToken;
    },
  };
}

export async function connectClient(deps: ServerDeps = {}) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(deps);
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    server,
    async close() {
      await client.close();
      await server.close();
    },
  };
}

export function sessionStoreFor(dir: string) {
  return createSessionStore(() => path.join(dir, "benepass-mcp", "session.json"));
}
