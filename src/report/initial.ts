import type { ArtifactStore } from "../artifacts/store.js";
import {
  type EvidenceType,
  type FinalResult,
  finalResultSchema,
} from "../contracts/report.js";
import { MOBTRACE_VERSION } from "../version.js";
import type { VerifyLifecycleResult } from "../verify/lifecycle.js";

export interface InitialReportResult {
  readonly compact: string;
  readonly jsonPath: string;
  readonly markdownPath: string;
  readonly result: FinalResult;
}

export async function generateInitialReports(
  artifactStore: ArtifactStore,
  lifecycle: VerifyLifecycleResult,
): Promise<InitialReportResult> {
  const generatedAt = new Date().toISOString();
  const result = finalResultSchema.parse({
    schemaVersion: 1,
    runId: lifecycle.runId,
    mobtraceVersion: MOBTRACE_VERSION,
    createdAt: lifecycle.phases[0]?.startedAt ?? generatedAt,
    completedAt: generatedAt,
    durationMs: totalDuration(lifecycle),
    generatedAt,
    generatedByVersion: MOBTRACE_VERSION,
    sourceRunCompletedAt: generatedAt,
    status: lifecycle.status,
    outcome: lifecycle.outcome,
    exitCode: lifecycle.exitCode,
    flow: {
      name: lifecycle.flow.flowName,
      path: lifecycle.flow.flowPathRelative,
      resolution: lifecycle.flow.resolution,
      runner: "maestro",
    },
    device: {
      id: lifecycle.flow.device ?? null,
      platform: "unknown",
      available: null,
    },
    source: sourceResult(lifecycle),
    journey: {
      status: lifecycle.journey.status,
      startedAt: lifecycle.journey.startedAt,
      endedAt: lifecycle.journey.endedAt,
      durationMs: lifecycle.journey.durationMs,
      exitCode: lifecycle.journey.exitCode,
      timedOut: lifecycle.journey.timedOut,
      command: lifecycle.journey.command,
      result: lifecycle.journey.result,
      stdout: lifecycle.journey.stdout,
      stderr: lifecycle.journey.stderr,
    },
    phases: lifecycle.phases,
    failure: failureFacts(lifecycle),
    diagnosis: diagnosis(lifecycle),
    evidence: evidence(lifecycle),
    reports: {
      markdown: "report.md",
      json: "result.json",
    },
  });

  const markdown = renderMarkdown(result);
  const markdownPath = await artifactStore.writeText(
    lifecycle.runId,
    "report.md",
    markdown,
  );
  const jsonPath = await artifactStore.writeJson(
    lifecycle.runId,
    "result.json",
    result,
  );

  return {
    compact: renderCompact(result, markdownPath, jsonPath),
    jsonPath,
    markdownPath,
    result,
  };
}

function sourceResult(lifecycle: VerifyLifecycleResult): FinalResult["source"] {
  if (!lifecycle.source.available) {
    return lifecycle.source;
  }

  return {
    available: true,
    baseline: lifecycle.source.baseline,
    baselineCommit: lifecycle.source.baselineCommit,
    branch: lifecycle.source.branch,
    changedFileCount: lifecycle.source.changedFileCount,
    changedFiles: lifecycle.source.changedFiles,
    diff: lifecycle.source.diff,
    dirty: lifecycle.source.dirty,
    head: lifecycle.source.head,
    metadata: lifecycle.source.metadata,
    untrackedFileCount: lifecycle.source.untrackedFileCount,
  };
}

function failureFacts(
  lifecycle: VerifyLifecycleResult,
): FinalResult["failure"] {
  if (lifecycle.journey.status === "failed") {
    return {
      failedCommand: lifecycle.journey.command?.arguments.join(" ") ?? null,
      failedSelector: null,
      message: lifecycle.journey.error?.message ?? "Journey failed.",
      summary: "The mobile journey failed.",
    };
  }

  const failedPhase = lifecycle.phases.find(
    (phase) => phase.status === "failed",
  );
  if (failedPhase !== undefined) {
    return {
      failedCommand: failedPhase.id,
      failedSelector: null,
      message: failedPhase.error?.message ?? "Phase failed.",
      summary: "MobTrace could not complete every lifecycle phase.",
    };
  }

  return {
    failedCommand: null,
    failedSelector: null,
    message: null,
    summary: null,
  };
}

function diagnosis(lifecycle: VerifyLifecycleResult): FinalResult["diagnosis"] {
  if (lifecycle.status === "passed") {
    return {
      failureClass: "none",
      failureDomain: "none",
      matchedSignatures: [],
      suspiciousChanges: [],
      suggestedAction:
        "No failure detected. Keep this run as baseline evidence.",
    };
  }

  return {
    failureClass: lifecycle.journey.timedOut
      ? "runner-timeout"
      : lifecycle.journey.status === "failed"
        ? "runner-error"
        : "processing-error",
    failureDomain:
      lifecycle.outcome === "journey-failed"
        ? "test-harness"
        : "infrastructure",
    matchedSignatures: [],
    suspiciousChanges: [],
    suggestedAction: "Inspect retained runner, hook, and source evidence.",
  };
}

function evidence(lifecycle: VerifyLifecycleResult): FinalResult["evidence"] {
  const references = [
    evidenceRef(
      "run-manifest",
      "run-manifest",
      "run.json",
      "application/json",
      "Run lifecycle manifest.",
      true,
      false,
    ),
  ];

  if (lifecycle.source.available) {
    references.push(
      evidenceRef(
        "source-metadata",
        "source-metadata",
        lifecycle.source.metadata,
        "application/json",
        "Source metadata.",
        true,
        false,
      ),
      evidenceRef(
        "source-changed-files",
        "source-changed-files",
        lifecycle.source.changedFiles,
        "application/json",
        "Changed source files.",
        true,
        false,
      ),
      evidenceRef(
        "source-diff",
        "source-diff",
        lifecycle.source.diff,
        "text/x-diff",
        "Source changes compared with the selected baseline.",
        false,
        true,
      ),
    );
  }

  for (const hook of lifecycle.hooks) {
    references.push(
      evidenceRef(
        `${hook.id}-result`,
        "hook-result",
        hook.result,
        "application/json",
        `${hook.id} result.`,
        true,
        false,
      ),
      evidenceRef(
        `${hook.id}-stdout`,
        "hook-log",
        hook.stdout,
        "text/plain",
        `${hook.id} standard output.`,
        false,
        true,
      ),
      evidenceRef(
        `${hook.id}-stderr`,
        "hook-log",
        hook.stderr,
        "text/plain",
        `${hook.id} standard error.`,
        false,
        true,
      ),
    );
  }

  if (lifecycle.journey.result !== null) {
    references.push(
      evidenceRef(
        "runner-result",
        "runner-result",
        lifecycle.journey.result,
        "application/json",
        "Normalized Maestro result.",
        true,
        false,
      ),
    );
  }
  if (lifecycle.journey.stdout !== null) {
    references.push(
      evidenceRef(
        "runner-stdout",
        "runner-log",
        lifecycle.journey.stdout,
        "text/plain",
        "Original Maestro standard output.",
        false,
        true,
      ),
    );
  }
  if (lifecycle.journey.stderr !== null) {
    references.push(
      evidenceRef(
        "runner-stderr",
        "runner-log",
        lifecycle.journey.stderr,
        "text/plain",
        "Original Maestro standard error.",
        false,
        true,
      ),
    );
  }

  references.push(
    evidenceRef(
      "normalized-evidence",
      "normalized-evidence",
      "evidence/normalized.json",
      "application/json",
      "Runner-independent lifecycle and journey facts.",
      true,
      false,
    ),
    evidenceRef(
      "human-report",
      "human-report",
      "report.md",
      "text/markdown",
      "Human-readable report.",
      true,
      false,
    ),
    evidenceRef(
      "machine-report",
      "machine-report",
      "result.json",
      "application/json",
      "Machine-readable report.",
      true,
      false,
    ),
  );

  return references;
}

function evidenceRef(
  id: string,
  type: EvidenceType,
  path: string,
  mediaType: string,
  description: string,
  redacted: boolean,
  sensitive: boolean,
): FinalResult["evidence"][number] {
  return { description, id, mediaType, path, redacted, sensitive, type };
}

function renderMarkdown(result: FinalResult): string {
  return `# MobTrace Report

Status: ${result.status}
Outcome: ${result.outcome}
Flow: ${result.flow.name ?? result.flow.path}

## Journey

Status: ${result.journey.status}
Exit code: ${result.journey.exitCode ?? "none"}

## Failure

${result.failure.summary ?? "None"}

## Suggested Action

${result.diagnosis.suggestedAction}
`;
}

function renderCompact(
  result: FinalResult,
  reportPath: string,
  jsonPath: string,
): string {
  const title = result.status === "passed" ? "PASSED" : "FAILED";
  return `${title} ${result.flow.name ?? result.flow.path}
Outcome: ${result.outcome}

Report: ${reportPath}
JSON: ${jsonPath}
`;
}

function totalDuration(lifecycle: VerifyLifecycleResult): number {
  return lifecycle.phases.reduce(
    (total, phase) => total + (phase.durationMs ?? 0),
    0,
  );
}
