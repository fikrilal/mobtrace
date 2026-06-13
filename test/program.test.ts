import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { MobtraceCommandError } from "../src/cli-error.js";
import { executeProcess } from "../src/process/execute.js";
import { createProgram } from "../src/program.js";

interface CapturedRun {
  exitCode: number;
  stderr: string;
  stdout: string;
}

const temporaryDirectories: string[] = [];

async function createProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mobtrace-program-"));
  temporaryDirectories.push(root);
  return root;
}

async function makeExecutable(path: string): Promise<void> {
  await writeFile(path, "#!/usr/bin/env sh\nexit 0\n", "utf8");
  await chmod(path, 0o755);
}

async function git(root: string, args: readonly string[]): Promise<void> {
  const result = await executeProcess({
    args,
    cwd: root,
    executable: "git",
  });
  expect(result.exitCode).toBe(0);
}

async function runProgram(args: string[]): Promise<CapturedRun> {
  let stderr = "";
  let stdout = "";
  let exitCode = 0;
  const writer = {
    write: (value: string) => {
      stdout += value;
    },
  };
  const errorWriter = {
    write: (value: string) => {
      stderr += value;
    },
  };
  const program = createProgram({ stderr: errorWriter, stdout: writer })
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
    if (error instanceof MobtraceCommandError) {
      exitCode = error.exitCode;
      if (error.message.length > 0) {
        stderr += `${error.message}\n`;
      }
    } else if (
      error instanceof Error &&
      "exitCode" in error &&
      typeof error.exitCode === "number"
    ) {
      exitCode = error.exitCode === 0 ? 0 : 2;
      if (exitCode !== 0) {
        throw error;
      }
    } else {
      throw error;
    }
  }

  return { exitCode, stderr, stdout };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await rm(path, { force: true, recursive: true });
    }),
  );
});

describe("MobTrace program", () => {
  it("prints help", async () => {
    const result = await runProgram(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Usage: mobtrace [options]");
    expect(result.stdout).toContain("--version");
    expect(result.stdout).toContain("doctor");
  });

  it("prints only the version", async () => {
    const result = await runProgram(["--version"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("0.1.0\n");
  });

  it("rejects unsupported commands", async () => {
    await expect(runProgram(["unknown"])).rejects.toMatchObject({
      code: "commander.unknownCommand",
      exitCode: 1,
    });
  });

  it("creates starter configuration with init", async () => {
    const root = await createProject();

    const result = await runProgram(["--project", root, "init"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(`Created ${join(root, "mobtrace.yaml")}`);
    expect(result.stdout).toContain(`Created ${join(root, ".gitignore")}`);
    expect(await readFile(join(root, ".gitignore"), "utf8")).toBe(
      ".mobtrace/\n",
    );
  });

  it("does not duplicate an existing MobTrace gitignore entry", async () => {
    const root = await createProject();
    await writeFile(join(root, ".gitignore"), ".mobtrace/\n", "utf8");

    const result = await runProgram(["--project", root, "init"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain(`Updated ${join(root, ".gitignore")}`);
    expect(await readFile(join(root, ".gitignore"), "utf8")).toBe(
      ".mobtrace/\n",
    );
  });

  it("refuses to replace configuration unless forced", async () => {
    const root = await createProject();
    await writeFile(join(root, "mobtrace.yaml"), "version: 1\n", "utf8");

    const refused = await runProgram(["--project", root, "init"]);
    const forced = await runProgram(["--project", root, "init", "--force"]);

    expect(refused.exitCode).toBe(2);
    expect(refused.stderr).toContain("Configuration already exists");
    expect(forced.exitCode).toBe(0);
  });

  it("prints doctor JSON without prose", async () => {
    const root = await createProject();
    await mkdir(join(root, "bin"), { recursive: true });
    await mkdir(join(root, ".maestro"), { recursive: true });
    await makeExecutable(join(root, "bin/git"));
    await makeExecutable(join(root, "bin/maestro"));
    await writeFile(join(root, ".maestro/login.yaml"), "appId: test\n", "utf8");
    await writeFile(
      join(root, "mobtrace.yaml"),
      `version: 1
maestro:
  executable: ./bin/maestro
flows:
  login:
    path: .maestro/login.yaml
`,
      "utf8",
    );
    const originalPath = process.env.PATH;
    process.env.PATH = `${join(root, "bin")}${process.platform === "win32" ? ";" : ":"}${originalPath ?? ""}`;

    try {
      const result = await runProgram(["--project", root, "doctor", "--json"]);
      const parsed = JSON.parse(result.stdout) as { ready: boolean };

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(parsed.ready).toBe(true);
      expect(result.stdout).not.toContain("MobTrace is ready");
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it("warns when the artifact root is not ignored by Git", async () => {
    const root = await createProject();
    await git(root, ["init"]);
    await mkdir(join(root, "bin"), { recursive: true });
    await mkdir(join(root, ".maestro"), { recursive: true });
    await makeExecutable(join(root, "bin/maestro"));
    await writeFile(join(root, ".maestro/login.yaml"), "appId: test\n", "utf8");
    await writeFile(
      join(root, "mobtrace.yaml"),
      `version: 1
maestro:
  executable: ./bin/maestro
flows:
  login:
    path: .maestro/login.yaml
`,
      "utf8",
    );

    const result = await runProgram(["--project", root, "doctor", "--json"]);
    const parsed = JSON.parse(result.stdout) as {
      checks: Array<{
        id: string;
        required: boolean;
        status: string;
        summary: string;
      }>;
      ready: boolean;
    };

    expect(result.exitCode).toBe(0);
    expect(parsed.ready).toBe(true);
    expect(parsed.checks).toContainEqual(
      expect.objectContaining({
        id: "gitignore",
        required: false,
        status: "failed",
        summary: ".mobtrace/runs is not ignored by Git.",
      }),
    );
  });

  it("returns invalid-config exit code while preserving doctor JSON", async () => {
    const root = await createProject();
    await writeFile(join(root, "mobtrace.yaml"), "version: 2\n", "utf8");

    const result = await runProgram(["--project", root, "doctor", "--json"]);
    const parsed = JSON.parse(result.stdout) as {
      checks: Array<{ id: string; status: string }>;
      ready: boolean;
    };

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe("");
    expect(parsed.ready).toBe(false);
    expect(parsed.checks).toContainEqual(
      expect.objectContaining({ id: "configuration", status: "failed" }),
    );
  });

  it("rejects mutually exclusive global verbosity options", async () => {
    const root = await createProject();

    const result = await runProgram([
      "--project",
      root,
      "--quiet",
      "--verbose",
      "init",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--quiet and --verbose");
  });
});
