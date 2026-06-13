import {
  chmod,
  cp,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ArtifactStore } from "../src/artifacts/store.js";
import { MobtraceCommandError } from "../src/cli-error.js";
import { discoverConfiguration } from "../src/configuration/load.js";
import { createDiagnosisContext } from "../src/diagnosis/context.js";
import { normalizeLifecycleEvidence } from "../src/evidence/normalized.js";
import { createProgram } from "../src/program.js";
import { generateBaselineReports } from "../src/report/baseline.js";
import { MaestroRunner } from "../src/runner/maestro.js";
import { createRunRedactor } from "../src/security/redaction.js";
import { runVerifyLifecycle } from "../src/verify/lifecycle.js";
import { executeProcess } from "../src/process/execute.js";

const fixtureRoot = resolve("test/fixtures/mobile-validation");
const temporaryDirectories: string[] = [];

interface CapturedRun {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

interface FinalResultSummary {
  readonly diagnosis: {
    readonly failureClass: string;
    readonly failureDomain: string;
    readonly suspiciousChanges: Array<{ path: string }>;
  };
  readonly exitCode: number;
  readonly journey: { readonly status: string };
  readonly outcome: string;
  readonly phases: Array<{ id: string; status: string }>;
  readonly runId: string;
  readonly status: string;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await rm(path, { force: true, recursive: true });
    }),
  );
});

describe("Milestone 8 product validation fixture", () => {
  it("demonstrates pass, representative failures, cleanup, and report regeneration", async () => {
    const project = await createValidationProject();

    const pass = await verifyJson(project, "pass");
    expect(pass.exitCode).toBe(0);
    expect(pass.result.status).toBe("passed");

    await replaceInFile(
      join(project, ".maestro/flows/selector-flow.yaml"),
      "home_screen",
      "home_screen_v2",
    );
    const selector = await verifyJson(project, "selector-flow");
    expect(selector.exitCode).toBe(1);
    expect(selector.result.diagnosis).toMatchObject({
      failureClass: "selector-mismatch",
      failureDomain: "test-harness",
    });
    expect(selector.result.diagnosis.suspiciousChanges[0]?.path).toBe(
      ".maestro/flows/selector-flow.yaml",
    );

    await replaceInFile(
      join(project, "lib/navigation/auth_router.dart"),
      "return sessionValid ? homeRoute : loginRoute;",
      "return loginRoute; // route not reached because session guard regressed",
    );
    const navigation = await verifyJson(project, "navigation");
    expect(navigation.exitCode).toBe(1);
    expect(navigation.result.diagnosis).toMatchObject({
      failureClass: "app-did-not-navigate",
      failureDomain: "application",
    });
    expect(navigation.result.diagnosis.suspiciousChanges[0]?.path).toBe(
      "lib/navigation/auth_router.dart",
    );

    await replaceInFile(
      join(project, "lib/features/auth/data/auth_repository.dart"),
      '"email": email,',
      '"username": email, // payload regression',
    );
    const backend = await verifyJson(project, "backend");
    expect(backend.exitCode).toBe(1);
    expect(backend.result.diagnosis).toMatchObject({
      failureClass: "backend-http-error",
      failureDomain: "backend",
    });
    expect(backend.result.diagnosis.suspiciousChanges[0]?.path).toBe(
      "lib/features/auth/data/auth_repository.dart",
    );

    const device = await verifyJson(project, "device-offline");
    expect(device.exitCode).toBe(1);
    expect(device.result.diagnosis).toMatchObject({
      failureClass: "device-not-ready",
      failureDomain: "infrastructure",
    });

    const prepare = await verifyJson(project, "prepare-failure");
    expect(prepare.exitCode).toBe(3);
    expect(prepare.result).toMatchObject({
      journey: { status: "not-run" },
      outcome: "preparation-failed",
      status: "error",
    });

    const cleanupAfterPass = await verifyJson(project, "cleanup-after-pass");
    expect(cleanupAfterPass.exitCode).toBe(4);
    expect(cleanupAfterPass.result).toMatchObject({
      journey: { status: "passed" },
      outcome: "cleanup-failed",
      status: "error",
    });

    const cleanupAfterFail = await verifyJson(project, "cleanup-after-fail");
    expect(cleanupAfterFail.exitCode).toBe(1);
    expect(cleanupAfterFail.result).toMatchObject({
      diagnosis: {
        failureClass: "selector-mismatch",
        failureDomain: "test-harness",
      },
      journey: { status: "failed" },
      outcome: "journey-failed",
      status: "failed",
    });
    expect(cleanupAfterFail.result.phases).toContainEqual(
      expect.objectContaining({ id: "cleanup-flow", status: "failed" }),
    );

    const reportPath = join(
      project,
      ".mobtrace/runs",
      backend.result.runId,
      "report.md",
    );
    await unlink(reportPath);
    const regenerated = await reportJson(project, backend.result.runId);
    expect(regenerated.exitCode).toBe(0);
    expect(regenerated.result.runId).toBe(backend.result.runId);
    expect(regenerated.result.diagnosis.failureClass).toBe(
      "backend-http-error",
    );
  });

  it("preserves an interrupted fixture run as partial reportable evidence", async () => {
    const project = await createValidationProject();
    const configuration = await discoverConfiguration(project);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);

    const lifecycle = await runVerifyLifecycle({
      abortSignal: controller.signal,
      configuration,
      flow: "interrupted",
      journeyRunner: new MaestroRunner(),
      projectRoot: project,
    });
    const store = new ArtifactStore(dirname(lifecycle.runDirectory));
    const context = await createDiagnosisContext(
      project,
      configuration.config,
      lifecycle.flow.ownership,
    );
    await store.writeJson(
      lifecycle.runId,
      "evidence/diagnosis-context.json",
      context,
    );
    const normalized = await normalizeLifecycleEvidence(
      store,
      lifecycle,
      createRunRedactor(context.redaction, lifecycle.flow.environment),
    );
    const reports = await generateBaselineReports(
      store,
      normalized.evidence,
      context,
    );
    const manifest = JSON.parse(
      await readFile(join(lifecycle.runDirectory, "run.json"), "utf8"),
    ) as { state: string };

    expect(lifecycle).toMatchObject({
      exitCode: 130,
      outcome: "interrupted",
      status: "interrupted",
    });
    expect(manifest.state).toBe("partial");
    expect(reports.result.status).toBe("interrupted");
    expect(
      await readFile(
        join(lifecycle.runDirectory, "interrupted-cleanup.txt"),
        "utf8",
      ),
    ).toBe("cleanup:interrupted\n");
  });
});

async function createValidationProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mobtrace-validation-"));
  temporaryDirectories.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  await Promise.all([
    chmod(join(root, "bin/maestro"), 0o755),
    chmod(join(root, "hooks/fail-prepare.sh"), 0o755),
    chmod(join(root, "hooks/fail-cleanup.sh"), 0o755),
    chmod(join(root, "hooks/record-cleanup.sh"), 0o755),
  ]);
  await git(root, ["init"]);
  await git(root, ["config", "user.email", "test@example.test"]);
  await git(root, ["config", "user.name", "MobTrace Validation"]);
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "base"]);
  return root;
}

async function verifyJson(
  project: string,
  flow: string,
): Promise<{ readonly exitCode: number; readonly result: FinalResultSummary }> {
  const run = await runProgram([
    "--project",
    project,
    "verify",
    "--flow",
    flow,
    "--json",
  ]);
  return {
    exitCode: run.exitCode,
    result: JSON.parse(run.stdout) as FinalResultSummary,
  };
}

async function reportJson(
  project: string,
  runId: string,
): Promise<{ readonly exitCode: number; readonly result: FinalResultSummary }> {
  const run = await runProgram([
    "--project",
    project,
    "report",
    runId,
    "--json",
  ]);
  return {
    exitCode: run.exitCode,
    result: JSON.parse(run.stdout) as FinalResultSummary,
  };
}

async function runProgram(args: readonly string[]): Promise<CapturedRun> {
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
    await program.parseAsync([...args], { from: "user" });
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

  expect(stderr).toBe("");
  return { exitCode, stderr, stdout };
}

async function replaceInFile(
  path: string,
  search: string,
  replacement: string,
): Promise<void> {
  const content = await readFile(path, "utf8");
  if (!content.includes(search)) {
    throw new Error(`${path} does not contain ${search}`);
  }
  await writeFile(path, content.replace(search, replacement), "utf8");
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  const result = await executeProcess({ args, cwd, executable: "git" });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr);
  }
}
