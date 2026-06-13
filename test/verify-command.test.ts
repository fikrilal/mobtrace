import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { MobtraceCommandError } from "../src/cli-error.js";
import { normalizedEvidenceSchema } from "../src/evidence/normalized.js";
import { createProgram } from "../src/program.js";
import { executeProcess } from "../src/process/execute.js";

const temporaryDirectories: string[] = [];

interface CapturedRun {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

async function createProject(
  maestroExitCode: number,
  maestroError = "fake maestro stderr",
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mobtrace-verify-command-"));
  temporaryDirectories.push(root);
  await git(root, ["init"]);
  await git(root, ["config", "user.email", "test@example.test"]);
  await git(root, ["config", "user.name", "MobTrace Test"]);
  await mkdir(join(root, ".maestro"), { recursive: true });
  await writeFile(join(root, ".maestro/login.yaml"), "appId: test\n", "utf8");
  const maestro = await createExecutable(
    root,
    "maestro",
    `if [ "$1" = "--version" ]; then
  printf "maestro 2.test\\n"
  exit 0
fi
printf "fake maestro stdout\\n"
printf '${maestroError}\\n' >&2
exit ${maestroExitCode}`,
  );
  await writeFile(
    join(root, "mobtrace.yaml"),
    `version: 1
maestro:
  executable: ${maestro}
flows:
  login:
    path: .maestro/login.yaml
`,
    "utf8",
  );
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "base"]);
  return root;
}

async function createExecutable(
  root: string,
  name: string,
  body: string,
): Promise<string> {
  const path = join(root, name);
  await writeFile(path, `#!/usr/bin/env sh\n${body}\n`, "utf8");
  await chmod(path, 0o755);
  return path;
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  const result = await executeProcess({ args, cwd, executable: "git" });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr);
  }
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

describe("verify command", () => {
  it("prints compact output and writes initial reports for a passing journey", async () => {
    const root = await createProject(0);

    const result = await runProgram([
      "--project",
      root,
      "verify",
      "--flow",
      "login",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("PASSED login");
    expect(result.stdout).toContain("Report:");
    expect(result.stdout).toContain("JSON:");

    const runIds = await readdir(join(root, ".mobtrace/runs"));
    expect(runIds).toHaveLength(1);
    const runDirectory = join(root, ".mobtrace/runs", runIds[0] ?? "");
    const machineReport = JSON.parse(
      await readFile(join(runDirectory, "result.json"), "utf8"),
    ) as {
      evidence: Array<{ id: string; path: string }>;
      exitCode: number;
      journey: { status: string };
      status: string;
    };
    expect(machineReport).toMatchObject({
      exitCode: 0,
      journey: { status: "passed" },
      status: "passed",
    });
    expect(await readFile(join(runDirectory, "report.md"), "utf8")).toContain(
      "MobTrace Report",
    );
    const normalized = normalizedEvidenceSchema.parse(
      JSON.parse(
        await readFile(join(runDirectory, "evidence/normalized.json"), "utf8"),
      ),
    );
    expect(normalized).toMatchObject({
      flow: { name: "login", runner: "maestro" },
      journey: { status: "passed" },
      run: { exitCode: 0, status: "passed" },
    });
    expect(machineReport).toMatchObject({
      evidence: expect.arrayContaining([
        expect.objectContaining({
          id: "normalized-evidence",
          path: "evidence/normalized.json",
        }),
      ]),
    });
  });

  it("prints only JSON and preserves failing journey exit code", async () => {
    const root = await createProject(1);

    const result = await runProgram([
      "--project",
      root,
      "verify",
      "--flow",
      "login",
      "--json",
    ]);
    const parsed = JSON.parse(result.stdout) as {
      diagnosis: { failureClass: string; failureDomain: string };
      exitCode: number;
      journey: { status: string };
      status: string;
    };

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("FAILED login");
    expect(parsed).toMatchObject({
      exitCode: 1,
      journey: { status: "failed" },
      status: "failed",
    });
    expect(parsed).toMatchObject({
      diagnosis: {
        failureClass: "unknown",
        failureDomain: "unknown",
      },
    });
  });

  it("extracts and renders a failed selector from retained runner output", async () => {
    const root = await createProject(
      1,
      'Failed command: assertVisible\nElement not found: "home_screen"',
    );

    const result = await runProgram([
      "--project",
      root,
      "verify",
      "--flow",
      "login",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Class: selector-mismatch");
    expect(result.stdout).toContain("Domain: test-harness");
    expect(result.stdout).toContain("Failed selector: home_screen");
    expect(result.stdout).toContain(
      "Compare the selector with the final visible hierarchy.",
    );
  });

  it("excludes known secrets from every generated output surface", async () => {
    const secret = "fixture-secret-123";
    const root = await createProject(
      1,
      `error password=${secret}\nFailed command: inputText\nBearer ${secret}`,
    );
    process.env.TEST_SECRET = secret;
    await writeFile(
      join(root, "mobtrace.yaml"),
      `version: 1
maestro:
  executable: ${join(root, "maestro")}
diagnosis:
  redact:
    environment: [TEST_SECRET]
flows:
  login:
    path: .maestro/login.yaml
    environment:
      LOGIN_SECRET:
        fromEnv: TEST_SECRET
`,
      "utf8",
    );

    try {
      const result = await runProgram([
        "--project",
        root,
        "verify",
        "--flow",
        "login",
      ]);
      const [runId] = await readdir(join(root, ".mobtrace/runs"));
      const runDirectory = join(root, ".mobtrace/runs", runId ?? "");
      const generated = await Promise.all(
        [
          "evidence/normalized.json",
          "result.json",
          "report.md",
          "evidence/diagnosis-context.json",
        ].map((path) => readFile(join(runDirectory, path), "utf8")),
      );

      expect(result.stdout).not.toContain(secret);
      expect(generated.join("\n")).not.toContain(secret);
      expect(generated.join("\n")).toContain("[REDACTED]");
      expect(
        await readFile(join(runDirectory, "runner/stderr.log"), "utf8"),
      ).not.toContain(secret);
      expect(
        await readFile(join(runDirectory, "runner/stderr.log"), "utf8"),
      ).toContain("[REDACTED]");
      const report = JSON.parse(generated[1] ?? "{}") as {
        evidence: Array<{
          id: string;
          redacted: boolean;
          sensitive: boolean;
        }>;
      };
      expect(report.evidence).toContainEqual(
        expect.objectContaining({
          id: "runner-stderr",
          redacted: true,
          sensitive: true,
        }),
      );
    } finally {
      delete process.env.TEST_SECRET;
    }
  });

  it("validates external signature files before starting mobile execution", async () => {
    const root = await createProject(0);
    await writeFile(join(root, "signatures.json"), "{not-json", "utf8");
    await writeFile(
      join(root, "mobtrace.yaml"),
      `version: 1
maestro:
  executable: ${join(root, "maestro")}
diagnosis:
  signatures: [signatures.json]
flows:
  login:
    path: .maestro/login.yaml
`,
      "utf8",
    );

    await expect(
      runProgram(["--project", root, "verify", "--flow", "login"]),
    ).rejects.toThrow();
    await expect(readdir(join(root, ".mobtrace/runs"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
