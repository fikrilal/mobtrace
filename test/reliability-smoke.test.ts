import { describe, expect, it } from "vitest";

import { executeProcess } from "../src/process/execute.js";

describe("repeated local process reliability", () => {
  it("completes repeated bounded executions with duration evidence", async () => {
    const iterations = 20;
    const results = [];

    for (let index = 0; index < iterations; index += 1) {
      results.push(
        await executeProcess({
          args: ["-e", `process.stdout.write("${index}")`],
          executable: process.execPath,
          maxOutputBytes: 1024,
          timeoutMs: 2000,
        }),
      );
    }

    expect(results).toHaveLength(iterations);
    expect(results.every((result) => result.exitCode === 0)).toBe(true);
    expect(results.every((result) => result.durationMs >= 0)).toBe(true);
    expect(results.every((result) => !result.stdoutTruncated)).toBe(true);
  });
});
