import { describe, expect, it } from "vitest";

import { createProgram } from "../src/program.js";

interface CapturedRun {
  stderr: string;
  stdout: string;
}

async function runProgram(args: string[]): Promise<CapturedRun> {
  let stderr = "";
  let stdout = "";
  const program = createProgram()
    .exitOverride()
    .configureOutput({
      writeErr: (value) => {
        stderr += value;
      },
      writeOut: (value) => {
        stdout += value;
      },
    });

  try {
    await program.parseAsync(args, { from: "user" });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("exitCode" in error) ||
      error.exitCode !== 0
    ) {
      throw error;
    }
  }

  return { stderr, stdout };
}

describe("MobTrace program", () => {
  it("prints help", async () => {
    const result = await runProgram(["--help"]);

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Usage: mobtrace [options]");
    expect(result.stdout).toContain("--version");
  });

  it("prints only the version", async () => {
    const result = await runProgram(["--version"]);

    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("0.0.0\n");
  });

  it("rejects unsupported commands", async () => {
    await expect(runProgram(["unknown"])).rejects.toMatchObject({
      code: "commander.excessArguments",
      exitCode: 1,
    });
  });
});
