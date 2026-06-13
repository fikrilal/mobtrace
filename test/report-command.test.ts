import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ArtifactStore } from "../src/artifacts/store.js";
import { MobtraceCommandError } from "../src/cli-error.js";
import type { DiagnosisContext } from "../src/diagnosis/context.js";
import {
  type NormalizedEvidence,
  normalizedEvidenceSchema,
} from "../src/evidence/normalized.js";
import { createProgram } from "../src/program.js";
import { generateBaselineReports } from "../src/report/baseline.js";

const temporaryDirectories: string[] = [];

interface CapturedRun {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await rm(path, { force: true, recursive: true });
    }),
  );
});

describe("report command", () => {
  it("resolves latest by manifest creation time and ignores historical failure exit", async () => {
    const root = await createProject();
    await createRetainedRun(root, {
      completedAt: "2026-06-12T09:00:02.000Z",
      createdAt: "2026-06-12T09:00:00.000Z",
      flowName: "older",
      runId: "20260612T090000Z-e00001",
      status: "passed",
    });
    await createRetainedRun(root, {
      completedAt: "2026-06-12T10:00:02.000Z",
      createdAt: "2026-06-12T10:00:00.000Z",
      flowName: "newer-failed",
      runId: "20260612T100000Z-e00002",
      status: "failed",
    });

    const result = await runProgram([
      "--project",
      root,
      "report",
      "latest",
      "--json",
    ]);
    const parsed = JSON.parse(result.stdout) as {
      flow: { name: string };
      status: string;
    };

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(parsed).toMatchObject({
      flow: { name: "newer-failed" },
      status: "failed",
    });
  });

  it("regenerates missing reports without executing a journey", async () => {
    const root = await createProject();
    const run = await createRetainedRun(root, {
      completedAt: "2026-06-12T10:00:02.000Z",
      createdAt: "2026-06-12T10:00:00.000Z",
      flowName: "login",
      runId: "20260612T100000Z-e00003",
      status: "failed",
    });
    const original = JSON.parse(
      await run.store.readText(run.runId, "result.json"),
    ) as { diagnosis: unknown };
    await Promise.all([
      rm(join(run.directory, "result.json")),
      rm(join(run.directory, "report.md")),
    ]);

    const result = await runProgram([
      "--project",
      root,
      "report",
      run.runId,
      "--full",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("# MobTrace Report");
    expect(result.stdout).toContain("Status: failed");
    const regenerated = JSON.parse(
      await run.store.readText(run.runId, "result.json"),
    ) as { diagnosis: unknown };
    expect(regenerated.diagnosis).toEqual(original.diagnosis);
  });

  it("resolves an explicit artifact directory", async () => {
    const root = await createProject();
    const run = await createRetainedRun(root, {
      completedAt: "2026-06-12T10:00:02.000Z",
      createdAt: "2026-06-12T10:00:00.000Z",
      flowName: "profile",
      runId: "20260612T100000Z-e00004",
      status: "passed",
    });

    const result = await runProgram([
      "--project",
      root,
      "report",
      run.directory,
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("PASSED profile");
  });

  it("regenerates reports that are older than normalized evidence", async () => {
    const root = await createProject();
    const run = await createRetainedRun(root, {
      completedAt: "2026-06-12T10:00:02.000Z",
      createdAt: "2026-06-12T10:00:00.000Z",
      flowName: "stale",
      runId: "20260612T100000Z-e00005",
      status: "passed",
    });
    const store = new ArtifactStore(join(root, ".mobtrace/runs"));
    const evidence = retainedEvidence({
      completedAt: "2026-06-12T10:00:02.000Z",
      createdAt: "2026-06-12T10:00:00.000Z",
      flowName: "stale",
      runId: run.runId,
      status: "passed",
    });
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
    await store.writeJson(run.runId, "evidence/normalized.json", evidence);

    const result = await runProgram([
      "--project",
      root,
      "report",
      run.runId,
      "--json",
    ]);
    const parsed = JSON.parse(result.stdout) as { generatedAt: string };

    expect(result.exitCode).toBe(0);
    expect(parsed.generatedAt).not.toBe("2026-06-12T11:00:00.000Z");
  });

  it("rejects conflicting output modes", async () => {
    const root = await createProject();

    const result = await runProgram([
      "--project",
      root,
      "report",
      "--json",
      "--full",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--json and --full");
  });
});

async function createProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mobtrace-report-command-"));
  temporaryDirectories.push(root);
  return root;
}

async function createRetainedRun(
  root: string,
  options: {
    readonly completedAt: string;
    readonly createdAt: string;
    readonly flowName: string;
    readonly runId: string;
    readonly status: "failed" | "passed";
  },
): Promise<{
  readonly directory: string;
  readonly runId: string;
  readonly store: ArtifactStore;
}> {
  const store = new ArtifactStore(join(root, ".mobtrace/runs"));
  const initialized = await store.initializeRun({
    flowName: options.flowName,
    flowPath: `.maestro/${options.flowName}.yaml`,
    flowResolution: "configured",
    now: new Date(options.createdAt),
    runId: options.runId,
  });
  await store.updateManifest(
    options.runId,
    { state: "completed" },
    new Date(options.completedAt),
  );
  const evidence = retainedEvidence(options);
  await store.writeJson(options.runId, "evidence/normalized.json", evidence);
  await generateBaselineReports(
    store,
    evidence,
    emptyContext,
    new Date("2026-06-12T11:00:00.000Z"),
  );
  return {
    directory: initialized.directory,
    runId: options.runId,
    store,
  };
}

const emptyContext: DiagnosisContext = {
  ownership: [],
  ruleSetVersion: 1,
  schemaVersion: 1,
  signatures: [],
};

function retainedEvidence(options: {
  readonly completedAt: string;
  readonly createdAt: string;
  readonly flowName: string;
  readonly runId: string;
  readonly status: "failed" | "passed";
}): NormalizedEvidence {
  const failed = options.status === "failed";
  return normalizedEvidenceSchema.parse({
    schemaVersion: 1,
    run: {
      completedAt: options.completedAt,
      createdAt: options.createdAt,
      durationMs: 2000,
      exitCode: failed ? 1 : 0,
      mobtraceVersion: "0.0.0",
      outcome: failed ? "journey-failed" : "verified-pass",
      runId: options.runId,
      status: options.status,
    },
    flow: {
      name: options.flowName,
      path: `.maestro/${options.flowName}.yaml`,
      resolution: "configured",
      runner: "maestro",
    },
    device: {
      available: null,
      id: null,
      platform: "unknown",
    },
    source: {
      available: false,
      reason: "not-a-git-worktree",
    },
    journey: {
      command: {
        arguments: ["test", "<flow>"],
        executable: "maestro",
      },
      durationMs: 1000,
      endedAt: options.completedAt,
      error: failed
        ? {
            code: "runner-exit-nonzero",
            message: "Maestro reported a failed journey.",
          }
        : null,
      exitCode: failed ? 1 : 0,
      result: "runner/result.json",
      startedAt: options.createdAt,
      status: options.status,
      stderr: "runner/stderr.log",
      stdout: "runner/stdout.log",
      timedOut: false,
    },
    phases: [],
    hooks: [],
    failure: failed
      ? {
          failedCommand: "test <flow>",
          failedSelector: null,
          message: "Maestro reported a failed journey.",
          summary: "The mobile journey failed.",
        }
      : {
          failedCommand: null,
          failedSelector: null,
          message: null,
          summary: null,
        },
  });
}

async function runProgram(args: string[]): Promise<CapturedRun> {
  let stderr = "";
  let stdout = "";
  let exitCode = 0;
  const program = createProgram({
    stderr: { write: (value) => (stderr += value) },
    stdout: { write: (value) => (stdout += value) },
  })
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
