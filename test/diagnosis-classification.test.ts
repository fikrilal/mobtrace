import { describe, expect, it } from "vitest";

import { classifyFailure } from "../src/diagnosis/classify.js";
import {
  type NormalizedEvidence,
  normalizedEvidenceSchema,
} from "../src/evidence/normalized.js";

describe("failure classification", () => {
  it.each([
    {
      expectedClass: "none",
      expectedDomain: "none",
      evidence: evidence({ status: "passed" }),
      label: "pass",
    },
    {
      expectedClass: "runner-timeout",
      expectedDomain: "infrastructure",
      evidence: evidence({ timedOut: true }),
      label: "runner timeout",
    },
    {
      expectedClass: "device-not-ready",
      expectedDomain: "infrastructure",
      evidence: evidence({ message: "Device emulator-5554 is offline" }),
      label: "device unavailable",
    },
    {
      expectedClass: "device-not-ready",
      expectedDomain: "infrastructure",
      evidence: evidence({
        message: "Device emulator-5554 was requested, but it is not connected.",
      }),
      label: "device not connected",
    },
    {
      expectedClass: "runner-unavailable",
      expectedDomain: "infrastructure",
      evidence: evidence({ message: "Maestro not found: ENOENT" }),
      label: "runner unavailable",
    },
    {
      expectedClass: "fixture-setup-failed",
      expectedDomain: "test-harness",
      evidence: evidence({
        message: "fixture script failed",
        phaseId: "prepare-flow",
      }),
      label: "fixture setup",
    },
    {
      expectedClass: "fixture-cleanup-failed",
      expectedDomain: "backend",
      evidence: evidence({
        message: "HTTP 500 empty JSON response during cleanup",
        outcome: "cleanup-failed",
        phaseId: "cleanup-flow",
        status: "error",
      }),
      label: "backend cleanup",
    },
    {
      expectedClass: "selector-mismatch",
      expectedDomain: "test-harness",
      evidence: evidence({
        failedSelector: "home_screen",
        message: "Element not found",
        phaseId: "cleanup-flow",
      }),
      label: "journey failure with cleanup failure",
    },
    {
      expectedClass: "backend-http-error",
      expectedDomain: "backend",
      evidence: evidence({ message: "HTTP 401 unauthorized after login" }),
      label: "backend HTTP",
    },
    {
      expectedClass: "selector-mismatch",
      expectedDomain: "test-harness",
      evidence: evidence({
        failedSelector: "home_screen",
        message: "Element not found",
      }),
      label: "selector mismatch",
    },
    {
      expectedClass: "input-not-applied",
      expectedDomain: "test-harness",
      evidence: evidence({ message: "Input text was not applied" }),
      label: "input failure",
    },
    {
      expectedClass: "app-did-not-navigate",
      expectedDomain: "application",
      evidence: evidence({ message: "App did not navigate after submit" }),
      label: "navigation failure",
    },
    {
      expectedClass: "processing-error",
      expectedDomain: "infrastructure",
      evidence: evidence({
        message: "report generation failed",
        outcome: "processing-failed",
        phaseId: "report",
      }),
      label: "processing failure",
    },
    {
      expectedClass: "unknown",
      expectedDomain: "unknown",
      evidence: evidence({ message: "Unexpected journey failure" }),
      label: "unsupported journey failure",
    },
  ])("classifies $label", ({
    evidence: input,
    expectedClass,
    expectedDomain,
  }) => {
    const result = classifyFailure(input);

    expect(result.failureClass).toBe(expectedClass);
    expect(result.failureDomain).toBe(expectedDomain);
    expect(result.suggestedAction.length).toBeGreaterThan(0);
  });
});

function evidence(options: {
  readonly failedSelector?: string;
  readonly message?: string;
  readonly outcome?: NormalizedEvidence["run"]["outcome"];
  readonly phaseId?: NormalizedEvidence["phases"][number]["id"];
  readonly status?: "error" | "failed" | "passed";
  readonly timedOut?: boolean;
}): NormalizedEvidence {
  const passed = options.status === "passed";
  const errored = options.status === "error";
  return normalizedEvidenceSchema.parse({
    schemaVersion: 1,
    run: {
      completedAt: "2026-06-12T10:00:02.000Z",
      createdAt: "2026-06-12T10:00:00.000Z",
      durationMs: 2000,
      exitCode: passed ? 0 : errored ? 4 : 1,
      mobtraceVersion: "0.0.0",
      outcome: options.outcome ?? (passed ? "verified-pass" : "journey-failed"),
      runId: "20260612T100000Z-f00001",
      status: passed ? "passed" : errored ? "error" : "failed",
    },
    flow: {
      name: "login",
      path: ".maestro/login.yaml",
      resolution: "configured",
      runner: "maestro",
    },
    device: { available: null, id: null, platform: "unknown" },
    source: { available: false, reason: "not-a-git-worktree" },
    journey: {
      command: { arguments: ["test", "<flow>"], executable: "maestro" },
      durationMs: 1000,
      endedAt: "2026-06-12T10:00:02.000Z",
      error: passed
        ? null
        : { code: "runner-error", message: options.message ?? "failed" },
      exitCode: passed || errored ? 0 : 1,
      result: "runner/result.json",
      startedAt: "2026-06-12T10:00:01.000Z",
      status: passed || errored ? "passed" : "failed",
      stderr: "runner/stderr.log",
      stdout: "runner/stdout.log",
      timedOut: options.timedOut ?? false,
    },
    phases:
      options.phaseId === undefined
        ? []
        : [
            {
              durationMs: 1,
              endedAt: "2026-06-12T10:00:02.000Z",
              error: {
                code: "phase-failed",
                message: options.message ?? "failed",
              },
              evidence: [],
              exitCode: 1,
              id: options.phaseId,
              startedAt: "2026-06-12T10:00:01.999Z",
              status: "failed",
              timedOut: false,
            },
          ],
    hooks: [],
    failure: passed
      ? {
          failedCommand: null,
          failedSelector: null,
          message: null,
          summary: null,
        }
      : {
          failedCommand: "test <flow>",
          failedSelector: options.failedSelector ?? null,
          message: options.message ?? "failed",
          summary: "The mobile journey failed.",
        },
  });
}
