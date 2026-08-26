import type { CallToolResult } from "@modelcontextprotocol/server";
import { HsaInvestmentsNotFoundError } from "./errors.js";

function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function asObject(data: unknown): Record<string, unknown> {
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { data };
}

export function ok(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: jsonText(data) }],
    structuredContent: asObject(data),
  };
}

export function mapError(err: unknown): CallToolResult {
  if (err instanceof HsaInvestmentsNotFoundError) {
    const payload = {
      error: err.message,
      attempts: err.attempts,
      hsa_account_details: err.hsaAccountDetails,
    };
    return {
      isError: true,
      content: [{ type: "text", text: jsonText(payload) }],
    };
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

export async function runTool(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return ok(await fn());
  } catch (err) {
    return mapError(err);
  }
}
