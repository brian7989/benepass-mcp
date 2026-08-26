import { chmod, mkdir, readFile, unlink } from "node:fs/promises";
import * as path from "node:path";
import { writeFile } from "atomically";
import envPaths from "env-paths";
import * as z from "zod";
import { AuthenticationError, errorCode, NotLoggedInError } from "./errors.js";

export const SessionSchema = z.object({
  email: z.string().email(),
  refreshToken: z.string().min(1),
  workspaceId: z.string().min(1).optional(),
});

export type Session = z.infer<typeof SessionSchema>;

export type SessionStore = {
  path(): string;
  load(): Promise<Session | undefined>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
  require(): Promise<Session>;
  saveWorkspaceId(workspaceId: string): Promise<void>;
};

function defaultSessionPath(): string {
  const override = process.env.BENEPASS_SESSION_PATH;
  if (override !== undefined && override.length > 0) {
    return override;
  }
  const paths = envPaths("benepass-mcp", { suffix: "" });
  return path.join(paths.config, "session.json");
}

export function createSessionStore(filePath: () => string = defaultSessionPath): SessionStore {
  return {
    path: filePath,

    async load() {
      try {
        const raw = await readFile(filePath(), "utf8");
        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          throw new AuthenticationError("Session file is not valid JSON");
        }
        const parsed = SessionSchema.safeParse(json);
        if (!parsed.success) {
          throw new AuthenticationError("Session file is invalid");
        }
        return parsed.data;
      } catch (err) {
        if (errorCode(err) === "ENOENT") {
          return undefined;
        }
        throw err;
      }
    },

    async save(session) {
      const file = filePath();
      const dir = path.dirname(file);
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await chmod(dir, 0o700).catch(() => undefined);
      const parsed = SessionSchema.parse(session);
      const payload: { email: string; refreshToken: string; workspaceId?: string } = {
        email: parsed.email,
        refreshToken: parsed.refreshToken,
      };
      if (parsed.workspaceId !== undefined) {
        payload.workspaceId = parsed.workspaceId;
      }
      await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await chmod(file, 0o600);
    },

    async clear() {
      try {
        await unlink(filePath());
      } catch (err) {
        if (errorCode(err) === "ENOENT") {
          return;
        }
        throw err;
      }
    },

    async require() {
      const session = await this.load();
      if (!session) {
        throw new NotLoggedInError();
      }
      return session;
    },

    async saveWorkspaceId(workspaceId) {
      const session = await this.require();
      await this.save({
        email: session.email,
        refreshToken: session.refreshToken,
        workspaceId,
      });
    },
  };
}

export function sessionFilePath(): string {
  return defaultSessionPath();
}
