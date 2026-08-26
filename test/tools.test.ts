import { FORBIDDEN_TOOL_SUBSTR } from "../src/tools/catalog.js";
import { createServer, registeredToolNames } from "../src/server.js";

describe("registered tools", () => {
  it("does not register mutating or generic API tools", () => {
    createServer();
    const names = registeredToolNames();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const lower = name.toLowerCase();
      for (const fragment of FORBIDDEN_TOOL_SUBSTR) {
        expect(lower, `${name} contains ${fragment}`).not.toContain(fragment);
      }
    }
  });
});
