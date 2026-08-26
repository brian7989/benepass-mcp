import { FORBIDDEN_TOOL_SUBSTR, TOOL_NAMES } from "../src/tools.js";
import { connectClient } from "./helpers.js";

describe("registered tools", () => {
  it("does not register mutating or generic API tools", async () => {
    const { client, close } = await connectClient({
      cognito: {
        initiateCustomAuth: async () => ({
          challenge_name: "CUSTOM_CHALLENGE",
          challenge_session: "s",
        }),
        respondToAuthChallenge: async () => "rt",
      },
    });
    try {
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name);
      expect(names).toEqual([...TOOL_NAMES]);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        const lower = name.toLowerCase();
        for (const fragment of FORBIDDEN_TOOL_SUBSTR) {
          expect(lower, `${name} contains ${fragment}`).not.toContain(fragment);
        }
      }
    } finally {
      await close();
    }
  });
});
