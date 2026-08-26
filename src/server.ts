import { McpServer } from "@modelcontextprotocol/server";
import { SERVER_NAME, SERVER_VERSION } from "./benepass/constants.js";
import { registerAccountTools } from "./tools/accounts.js";
import { registerAuthTools } from "./tools/auth.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerHsaTools } from "./tools/hsa.js";
import { registerTransactionTools } from "./tools/transactions.js";
import { registerUserTools } from "./tools/user.js";
import { registerWorkspaceTools } from "./tools/workspaces.js";

const registeredNames: string[] = [];

export function createServer(): McpServer {
  registeredNames.length = 0;
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const registerTool = server.registerTool.bind(server);
  server.registerTool = ((
    name: string,
    ...rest: Parameters<McpServer["registerTool"]> extends [string, ...infer R] ? R : never
  ) => {
    registeredNames.push(name);
    return registerTool(name, ...rest);
  }) as McpServer["registerTool"];
  registerAuthTools(server);
  registerWorkspaceTools(server);
  registerAccountTools(server);
  registerTransactionTools(server);
  registerHsaTools(server);
  registerDocumentTools(server);
  registerUserTools(server);
  return server;
}

export function registeredToolNames(): string[] {
  if (registeredNames.length === 0) {
    createServer();
  }
  return [...registeredNames];
}
