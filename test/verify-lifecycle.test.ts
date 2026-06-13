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

import { discoverConfiguration } from "../src/configuration/load.js";
import type {
  JourneyExecutionInput,
  JourneyExecutionResult,
  JourneyRunner,
} from "../src/verify/lifecycle.js";
import { runVerifyLifecycle } from "../src/verify/lifecycle.js";
import { executeProcess } from "../src/process/execute.js";

const temporaryDirectories: string[] = [];

async function createProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mobtrace-verify-"));
  temporaryDirectories.push(root);
  await git(root, ["init"]);
  await git(root, ["config", "user.email", "test@example.test"]);
  await git(root, ["config", "user.name", "MobTrace Test"]);
  await mkdir(join(root, ".maestro"), { recursive: true });
  await writeFile(join(root, ".maestro/login.yaml"), "appId: test\n", "utf8");
  await writeFile(join(root, "README.md"), "base\n", "utf8");
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "base"]);
  return root;
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  const result = await executeProcess({ args, cwd, executable: "git" });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr);
  }
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

function journey(status: "failed" | "passed"): JourneyRunner {
  return {
    async run(_input: JourneyExecutionInput): Promise<JourneyExecutionResult> {
      const now = new Date().toISOString();
      return {
        command: { arguments: ["test", "<flow>"], executable: "maestro" },
        durationMs: 1,
        endedAt: now,
        error:
          status === "failed"
            ? { code: "runner-exit-nonzero", message: "Journey failed." }
            : null,
        exitCode: status === "passed" ? 0 : 1,
        result: "runner/result.json",
        startedAt: now,
        status,
        stderr: "runner/stderr.log",
        stdout: "runner/stdout.log",
        timedOut: false,
      };
    },
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await rm(path, { force: true, recursive: true });
    }),
  );
});

describe("verify lifecycle", () => {
  it("creates a completed run for a passing direct path journey", async () => {
    const root = await createProject();
    const configuration = await discoverConfiguration(root);

    const result = await runVerifyLifecycle({
      configuration,
      flow: ".maestro/login.yaml",
      journeyRunner: journey("passed"),
      projectRoot: root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.status).toBe("passed");
    expect(result.outcome).toBe("verified-pass");
    expect(result.journey.status).toBe("passed");
    expect(result.phases.map((phase) => [phase.id, phase.status])).toEqual([
      ["validation", "passed"],
      ["source", "passed"],
      ["prepare-project", "skipped"],
      ["prepare-flow", "skipped"],
      ["journey", "passed"],
      ["cleanup-flow", "skipped"],
      ["cleanup-project", "skipped"],
    ]);

    const manifest = JSON.parse(
      await readFile(join(result.runDirectory, "run.json"), "utf8"),
    ) as { state: string };
    expect(manifest.state).toBe("completed");
  });

  it("returns journey failure precedence over cleanup failure", async () => {
    const root = await createProject();
    const cleanup = await createExecutable(root, "cleanup", "exit 7");
    await writeFile(
      join(root, "mobtrace.yaml"),
      `version: 1
flows:
  login:
    path: .maestro/login.yaml
    hooks:
      cleanup:
        command: ["${cleanup}"]
`,
      "utf8",
    );
    const configuration = await discoverConfiguration(root);

    const result = await runVerifyLifecycle({
      configuration,
      flow: "login",
      journeyRunner: journey("failed"),
      projectRoot: root,
    });

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toBe("journey-failed");
    expect(result.phases).toContainEqual(
      expect.objectContaining({ id: "cleanup-flow", status: "failed" }),
    );
  });

  it("returns cleanup failure when journey passed", async () => {
    const root = await createProject();
    const cleanup = await createExecutable(root, "cleanup", "exit 7");
    await writeFile(
      join(root, "mobtrace.yaml"),
      `version: 1
flows:
  login:
    path: .maestro/login.yaml
    hooks:
      cleanup:
        command: ["${cleanup}"]
`,
      "utf8",
    );
    const configuration = await discoverConfiguration(root);

    const result = await runVerifyLifecycle({
      configuration,
      flow: "login",
      journeyRunner: journey("passed"),
      projectRoot: root,
    });

    expect(result.exitCode).toBe(4);
    expect(result.outcome).toBe("cleanup-failed");
  });

  it("runs cleanup after preparation failure and skips the journey", async () => {
    const root = await createProject();
    const recorder = join(root, "order.txt");
    const prepare = await createExecutable(
      root,
      "prepare",
      `printf "prepare\\n" >> "${recorder}"
exit 9`,
    );
    const cleanup = await createExecutable(
      root,
      "cleanup",
      `printf "cleanup\\n" >> "${recorder}"`,
    );
    await writeFile(
      join(root, "mobtrace.yaml"),
      `version: 1
hooks:
  cleanup:
    command: ["${cleanup}"]
flows:
  login:
    path: .maestro/login.yaml
    hooks:
      prepare:
        command: ["${prepare}"]
`,
      "utf8",
    );
    const configuration = await discoverConfiguration(root);
    let journeyRan = false;

    const result = await runVerifyLifecycle({
      configuration,
      flow: "login",
      journeyRunner: {
        async run(): Promise<JourneyExecutionResult> {
          journeyRan = true;
          return journey("passed").run({} as JourneyExecutionInput);
        },
      },
      projectRoot: root,
    });

    expect(result.exitCode).toBe(3);
    expect(result.outcome).toBe("preparation-failed");
    expect(journeyRan).toBe(false);
    expect(await readFile(recorder, "utf8")).toBe("prepare\ncleanup\n");
  });

  it("fails before the journey when source baseline is invalid", async () => {
    const root = await createProject();
    const configuration = await discoverConfiguration(root);
    let journeyRan = false;

    const result = await runVerifyLifecycle({
      baseline: "missing-ref",
      configuration,
      flow: ".maestro/login.yaml",
      journeyRunner: {
        async run(): Promise<JourneyExecutionResult> {
          journeyRan = true;
          return journey("passed").run({} as JourneyExecutionInput);
        },
      },
      projectRoot: root,
    });

    expect(result.exitCode).toBe(3);
    expect(result.outcome).toBe("infrastructure-failed");
    expect(journeyRan).toBe(false);
    expect(result.phases).toContainEqual(
      expect.objectContaining({ id: "source", status: "failed" }),
    );
  });
});
