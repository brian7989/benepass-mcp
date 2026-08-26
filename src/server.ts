import { McpServer } from "@modelcontextprotocol/server";
import { type ServerDeps, createApp } from "./app.js";
import { registerTools } from "./tools.js";
import { SERVER_NAME, SERVER_VERSION } from "./version.js";

export { TOOL_NAMES, FORBIDDEN_TOOL_SUBSTR } from "./tools.js";
export type { ServerDeps } from "./app.js";

export function createServer(deps: ServerDeps = {}): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerTools(server, createApp(deps));
  return server;
}
