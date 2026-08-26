#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";

void serveStdio(() => createServer(), {
  onerror: (error) => {
    console.error("benepass-mcp:", error.message);
  },
});
console.error("benepass-mcp running on stdio");
