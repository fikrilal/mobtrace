import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  finalResultSchema,
  portablePathSchema,
  runManifestSchema,
} from "../src/contracts/report.js";

async function fixture(name: string): Promise<unknown> {
  return JSON.parse(
    await readFile(
      new URL(`./fixtures/report/${name}`, import.meta.url),
      "utf8",
    ),
  ) as unknown;
}

describe("report contract schemas", () => {
  it.each([
    "run-running.json",
    "run-partial.json",
  ])("parses manifest fixture %s", async (name) => {
    expect(runManifestSchema.parse(await fixture(name))).toBeDefined();
  });

  it.each([
    "result-passed.json",
    "result-failed.json",
  ])("parses result fixture %s", async (name) => {
    expect(finalResultSchema.parse(await fixture(name))).toBeDefined();
  });

  it("ignores compatible unknown result fields", async () => {
    const result = finalResultSchema.parse(await fixture("result-failed.json"));

    expect(result).not.toHaveProperty("futureField");
  });

  it("rejects inconsistent terminal manifest timestamps", async () => {
    const value = (await fixture("run-running.json")) as Record<
      string,
      unknown
    >;

    expect(
      runManifestSchema.safeParse({ ...value, state: "completed" }).success,
    ).toBe(false);
  });

  it.each([
    "../report.md",
    "/tmp/report.md",
    "C:\\temp\\report.md",
    "runner//result.json",
    "runner/./result.json",
  ])("rejects non-portable path %s", (path) => {
    expect(portablePathSchema.safeParse(path).success).toBe(false);
  });
});
