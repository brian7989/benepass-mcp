import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  clearAccessTokenCache,
  initiateCustomAuth,
  respondToAuthChallenge,
} from "../auth/cognito.js";
import { deleteSession, loadSession, saveSession } from "../auth/session.js";
import { runTool } from "./result.js";

export async function completeLogin(args: {
  email: string;
  otp: string;
  challenge_session: string;
}): Promise<{ ok: true; email: string }> {
  const refreshToken = await respondToAuthChallenge(args.email, args.otp, args.challenge_session);
  clearAccessTokenCache();
  await saveSession({ email: args.email, refreshToken });
  return { ok: true, email: args.email };
}

export function registerAuthTools(server: McpServer): void {
  server.registerTool(
    "start_login",
    {
      description:
        "Start Benepass email OTP login. Sends a one-time code to the email and returns a short-lived challenge session.",
      inputSchema: z.object({
        email: z.string().email().describe("Benepass account email"),
      }),
    },
    async ({ email }) => runTool(async () => initiateCustomAuth(email)),
  );

  server.registerTool(
    "complete_login",
    {
      description:
        "Complete Benepass login with the email OTP and challenge session from start_login. Persists a local session; never returns tokens.",
      inputSchema: z.object({
        email: z.string().email().describe("Benepass account email"),
        otp: z.string().min(1).describe("One-time passcode from email"),
        challenge_session: z.string().min(1).describe("Session string from start_login"),
      }),
    },
    async (args) => runTool(async () => completeLogin(args)),
  );
  server.registerTool(
    "auth_status",
    {
      description:
        "Show whether a local Benepass session exists, and the logged-in email. Never returns secrets.",
      inputSchema: z.object({}),
    },
    async () =>
      runTool(async () => {
        const session = await loadSession();
        if (!session) {
          return { logged_in: false };
        }
        return { logged_in: true, email: session.email };
      }),
  );

  server.registerTool(
    "logout",
    {
      description: "Delete the local Benepass session file.",
      inputSchema: z.object({}),
    },
    async () =>
      runTool(async () => {
        clearAccessTokenCache();
        await deleteSession();
        return { ok: true };
      }),
  );
}
