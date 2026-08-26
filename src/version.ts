import { readFileSync } from "node:fs";
import * as z from "zod";

const PackageSchema = z.object({
  name: z.string(),
  version: z.string(),
});

const pkg = PackageSchema.parse(
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")),
);

export const SERVER_NAME = pkg.name;
export const SERVER_VERSION = pkg.version;
