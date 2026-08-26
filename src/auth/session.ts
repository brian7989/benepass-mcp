import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import * as path from "node:path";

export type Session = {
  email: string;
  refreshToken: string;
  workspaceId?: string;
};

function isErrno(err: unknown): err is { code: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  );
}

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  if (typeof rec.email !== "string" || typeof rec.refreshToken !== "string") {
    return false;
  }
  if (rec.workspaceId !== undefined && typeof rec.workspaceId !== "string") {
    return false;
  }
  return true;
}

export function sessionFilePath(): string {
  const override = process.env.BENEPPASS_SESSION_PATH;
  if (override && override.length > 0) {
    return override;
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : path.join(homedir(), ".config");
  return path.join(base, "benepass-mcp", "session.json");
}
export async function loadSession(): Promise<Session | undefined> {
  try {
    const raw = await readFile(sessionFilePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed)) {
      return undefined;
    }
    return parsed;
  } catch (err) {
    if (isErrno(err) && err.code === "ENOENT") {
      return undefined;
    }
    throw err;
  }
}

export async function saveSession(session: Session): Promise<void> {
  const file = sessionFilePath();
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const payload: Record<string, string> = {
    email: session.email,
    refreshToken: session.refreshToken,
  };
  if (session.workspaceId !== undefined) {
    payload.workspaceId = session.workspaceId;
  }
  await writeFile(file, JSON.stringify(payload, null, 2) + String.fromCharCode(10), {
    mode: 0o600,
  });
  await chmod(file, 0o600);
}

export async function saveWorkspaceId(workspaceId: string): Promise<void> {
  const session = await loadSession();
  if (!session) {
    throw new Error("Not logged in");
  }
  await saveSession({ email: session.email, refreshToken: session.refreshToken, workspaceId });
}

export async function deleteSession(): Promise<void> {
  try {
    await unlink(sessionFilePath());
  } catch (err) {
    if (isErrno(err) && err.code === "ENOENT") {
      return;
    }
    throw err;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await loadSession();
  if (!session) {
    throw new Error("Not logged in. Call start_login then complete_login first.");
  }
  return session;
}
