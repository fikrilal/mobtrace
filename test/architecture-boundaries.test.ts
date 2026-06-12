import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

async function listTypeScriptFiles(
  directory: string,
): Promise<readonly string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTypeScriptFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

describe("source boundaries", () => {
  it("keeps contracts and artifact storage independent of CLI presentation", async () => {
    const files = [
      ...(await listTypeScriptFiles(resolve("src/contracts"))),
      ...(await listTypeScriptFiles(resolve("src/artifacts"))),
    ];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, file).not.toMatch(
        /from\s+["'][^"']*(?:cli|program)\.js["']/,
      );
      expect(source, file).not.toContain('from "commander"');
    }
  });
});
