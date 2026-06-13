import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ArtifactStore } from "../src/artifacts/store.js";
import type { DiagnosisContext } from "../src/diagnosis/context.js";
import {
  type NormalizedEvidence,
  normalizedEvidenceSchema,
} from "../src/evidence/normalized.js";
import { generateBaselineReports } from "../src/report/baseline.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await rm(path, { force: true, recursive: true });
    }),
  );
});

describe("baseline report generation", () => {
  it("generates canonical JSON and structured Markdown from normalized evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "mobtrace-report-"));
    temporaryDirectories.push(root);
    const store = new ArtifactStore(join(root, "runs"));
    await store.initializeRun({
      flowName: "login",
      flowPath: ".maestro/login.yaml",
      flowResolution: "configured",
      now: new Date("2026-06-12T10:00:00.000Z"),
      runId: "20260612T100000Z-d00001",
    });
    await store.updateManifest(
      "20260612T100000Z-d00001",
      { state: "completed" },
      new Date("2026-06-12T10:00:02.000Z"),
    );
    const evidence = fixtureEvidence();

    const reports = await generateBaselineReports(
      store,
      evidence,
      emptyContext,
      new Date("2026-06-12T10:05:00.000Z"),
    );
    const markdown = await readFile(
      join(root, "runs/20260612T100000Z-d00001/report.md"),
      "utf8",
    );

    expect(reports.result).toMatchObject({
      completedAt: "2026-06-12T10:00:02.000Z",
      generatedAt: "2026-06-12T10:05:00.000Z",
      sourceRunCompletedAt: "2026-06-12T10:00:02.000Z",
      status: "failed",
    });
    expect(reports.result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "runner-stderr",
          redacted: false,
          sensitive: true,
        }),
        expect.objectContaining({
          id: "normalized-evidence",
          redacted: true,
          sensitive: false,
        }),
      ]),
    );
    expect(markdown).toContain("## Outcome");
    expect(markdown).toContain("## Run Metadata");
    expect(markdown).toContain("## Journey");
    expect(markdown).toContain("## Source");
    expect(markdown).toContain("## Hooks");
    expect(markdown).toContain("## Failure");
    expect(markdown).toContain("## Diagnosis");
    expect(markdown).toContain("### Suspicious Changes");
    expect(markdown).toContain("### Matched Signatures");
    expect(markdown).toContain("assertion-false-missing-id");
    expect(markdown).toContain("## Lifecycle Phases");
    expect(markdown).toContain("## Evidence");
    expect(markdown).toContain("## Suggested Action");
    expect(markdown).toContain(
      "- [runner-stderr](runner/stderr.log): Original Maestro standard error.",
    );
    expect(reports.compact).toBe(`FAILED login
Outcome: journey-failed

Class: selector-mismatch
Domain: test-harness
Failed selector: home_screen

Next action:
Compare the selector with the final visible hierarchy.

Report: report.md
JSON: result.json
`);
  });

  it.each([
    {
      exitCode: 3,
      journeyStatus: "not-run" as const,
      outcome: "infrastructure-failed" as const,
      status: "error" as const,
    },
    {
      exitCode: 4,
      journeyStatus: "passed" as const,
      outcome: "cleanup-failed" as const,
      status: "error" as const,
    },
    {
      exitCode: 130,
      journeyStatus: "interrupted" as const,
      outcome: "interrupted" as const,
      status: "interrupted" as const,
    },
  ])("generates a valid $outcome report", async ({
    exitCode,
    journeyStatus,
    outcome,
    status,
  }) => {
    const root = await mkdtemp(join(tmpdir(), "mobtrace-report-outcome-"));
    temporaryDirectories.push(root);
    const store = new ArtifactStore(join(root, "runs"));
    const runId = "20260612T100000Z-d00002";
    await store.initializeRun({
      flowName: "login",
      flowPath: ".maestro/login.yaml",
      flowResolution: "configured",
      now: new Date("2026-06-12T10:00:00.000Z"),
      runId,
    });
    await store.updateManifest(
      runId,
      { state: "partial" },
      new Date("2026-06-12T10:00:02.000Z"),
    );
    const base = fixtureEvidence();
    const evidence = normalizedEvidenceSchema.parse({
      ...base,
      run: {
        ...base.run,
        exitCode,
        outcome,
        runId,
        status,
      },
      journey: {
        ...base.journey,
        exitCode: journeyStatus === "passed" ? 0 : null,
        status: journeyStatus,
      },
    });

    const reports = await generateBaselineReports(
      store,
      evidence,
      emptyContext,
    );

    expect(reports.result).toMatchObject({
      exitCode,
      outcome,
      status,
    });
  });
});

function fixtureEvidence(): NormalizedEvidence {
  return normalizedEvidenceSchema.parse({
    schemaVersion: 1,
    run: {
      completedAt: "2026-06-12T10:00:02.000Z",
      createdAt: "2026-06-12T10:00:00.000Z",
      durationMs: 2000,
      exitCode: 1,
      mobtraceVersion: "0.0.0",
      outcome: "journey-failed",
      runId: "20260612T100000Z-d00001",
      status: "failed",
    },
    flow: {
      name: "login",
      path: ".maestro/login.yaml",
      resolution: "configured",
      runner: "maestro",
    },
    device: {
      available: null,
      id: "emulator-5554",
      platform: "android",
    },
    source: {
      available: true,
      baseline: "HEAD^",
      baselineCommit: "1".repeat(40),
      branch: "development",
      changedFileCount: 1,
      changedFiles: "source/changed-files.json",
      diff: "source/diff.patch",
      dirty: true,
      head: "2".repeat(40),
      metadata: "source/metadata.json",
      untrackedFileCount: 0,
    },
    journey: {
      command: {
        arguments: ["test", "<flow>"],
        executable: "maestro",
      },
      durationMs: 1000,
      endedAt: "2026-06-12T10:00:02.000Z",
      error: {
        code: "runner-exit-nonzero",
        message: "Maestro reported a failed journey.",
      },
      exitCode: 1,
      result: "runner/result.json",
      startedAt: "2026-06-12T10:00:01.000Z",
      status: "failed",
      stderr: "runner/stderr.log",
      stdout: "runner/stdout.log",
      timedOut: false,
    },
    phases: [
      {
        durationMs: 1000,
        endedAt: "2026-06-12T10:00:02.000Z",
        error: {
          code: "runner-exit-nonzero",
          message: "Maestro reported a failed journey.",
        },
        evidence: ["runner-result"],
        exitCode: 1,
        id: "journey",
        startedAt: "2026-06-12T10:00:01.000Z",
        status: "failed",
        timedOut: false,
      },
    ],
    hooks: [],
    failure: {
      failedCommand: "test <flow>",
      failedSelector: "home_screen",
      message: "Element not found: home_screen",
      summary:
        "The mobile journey failed while resolving an expected selector.",
    },
  });
}

const emptyContext: DiagnosisContext = {
  ownership: [],
  redaction: { environmentNames: [], patterns: [], schemaVersion: 1 },
  ruleSetVersion: 1,
  schemaVersion: 1,
  signatures: [],
};
