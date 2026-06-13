import type { ArtifactStore } from "../artifacts/store.js";
import {
  type EvidenceType,
  type FinalResult,
  finalResultSchema,
} from "../contracts/report.js";
import type { DiagnosisContext } from "../diagnosis/context.js";
import { diagnose } from "../diagnosis/diagnose.js";
import type { NormalizedEvidence } from "../evidence/normalized.js";
import { MOBTRACE_VERSION } from "../version.js";

export interface BaselineReportResult {
  readonly compact: string;
  readonly jsonPath: string;
  readonly markdown: string;
  readonly markdownPath: string;
  readonly result: FinalResult;
}

export async function generateBaselineReports(
  artifactStore: ArtifactStore,
  evidence: NormalizedEvidence,
  context: DiagnosisContext,
  now = new Date(),
): Promise<BaselineReportResult> {
  const generatedAt = now.toISOString();
  const diagnosis = await diagnose(artifactStore, evidence, context);
  const result = finalResultSchema.parse({
    schemaVersion: 1,
    runId: evidence.run.runId,
    mobtraceVersion: MOBTRACE_VERSION,
    createdAt: evidence.run.createdAt,
    completedAt: evidence.run.completedAt,
    durationMs: evidence.run.durationMs,
    generatedAt,
    generatedByVersion: MOBTRACE_VERSION,
    sourceRunCompletedAt: evidence.run.completedAt,
    status: evidence.run.status,
    outcome: evidence.run.outcome,
    exitCode: evidence.run.exitCode,
    flow: evidence.flow,
    device: evidence.device,
    source: evidence.source,
    journey: evidence.journey,
    phases: evidence.phases,
    failure: evidence.failure,
    diagnosis,
    evidence: evidenceIndex(evidence),
    reports: {
      markdown: "report.md",
      json: "result.json",
    },
  });

  const markdown = renderMarkdown(result);
  const markdownPath = await artifactStore.writeText(
    evidence.run.runId,
    "report.md",
    markdown,
  );
  const jsonPath = await artifactStore.writeJson(
    evidence.run.runId,
    "result.json",
    result,
  );

  return {
    compact: renderCompact(result, markdownPath, jsonPath),
    jsonPath,
    markdown,
    markdownPath,
    result,
  };
}

function evidenceIndex(evidence: NormalizedEvidence): FinalResult["evidence"] {
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

  if (evidence.source.available) {
    references.push(
      evidenceRef(
        "source-metadata",
        "source-metadata",
        evidence.source.metadata,
        "application/json",
        "Source metadata.",
        true,
        false,
      ),
      evidenceRef(
        "source-changed-files",
        "source-changed-files",
        evidence.source.changedFiles,
        "application/json",
        "Changed source files.",
        true,
        false,
      ),
      evidenceRef(
        "source-diff",
        "source-diff",
        evidence.source.diff,
        "text/x-diff",
        "Source changes compared with the selected baseline.",
        false,
        true,
      ),
    );
  }

  for (const hook of evidence.hooks) {
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

  if (evidence.journey.result !== null) {
    references.push(
      evidenceRef(
        "runner-result",
        "runner-result",
        evidence.journey.result,
        "application/json",
        "Normalized Maestro result.",
        true,
        false,
      ),
    );
  }
  if (evidence.journey.stdout !== null) {
    references.push(
      evidenceRef(
        "runner-stdout",
        "runner-log",
        evidence.journey.stdout,
        "text/plain",
        "Original Maestro standard output.",
        false,
        true,
      ),
    );
  }
  if (evidence.journey.stderr !== null) {
    references.push(
      evidenceRef(
        "runner-stderr",
        "runner-log",
        evidence.journey.stderr,
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
      "diagnosis-context",
      "normalized-evidence",
      "evidence/diagnosis-context.json",
      "application/json",
      "Non-sensitive deterministic diagnosis inputs.",
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

export function renderMarkdown(result: FinalResult): string {
  const source = result.source.available
    ? `Available: yes
Branch: ${result.source.branch ?? "detached HEAD"}
Head: ${result.source.head}
Baseline: ${result.source.baseline}
Dirty: ${result.source.dirty ? "yes" : "no"}
Changed files: ${result.source.changedFileCount}
Untracked files: ${result.source.untrackedFileCount}`
    : `Available: no
Reason: ${result.source.reason}`;
  const hooks =
    result.phases
      .filter(
        (phase) => phase.id.includes("prepare") || phase.id.includes("cleanup"),
      )
      .map(
        (phase) =>
          `- ${phase.id}: ${phase.status}${phase.exitCode === null ? "" : ` (exit ${phase.exitCode})`}`,
      )
      .join("\n") || "None";
  const phases = result.phases
    .map(
      (phase) =>
        `- ${phase.id}: ${phase.status}${phase.error === null ? "" : ` - ${phase.error.message}`}`,
    )
    .join("\n");
  const evidence = result.evidence
    .map((item) => `- [${item.id}](${item.path}): ${item.description}`)
    .join("\n");

  return `# MobTrace Report

## Outcome

Status: ${result.status}
Outcome: ${result.outcome}
Exit code: ${result.exitCode}

## Run Metadata

Run: ${result.runId}
Flow: ${result.flow.name ?? result.flow.path}
Flow path: ${result.flow.path}
Resolution: ${result.flow.resolution}
Device: ${result.device.id ?? "not selected"}
Created: ${result.createdAt}
Completed: ${result.completedAt}
Duration: ${result.durationMs}ms

## Journey

Status: ${result.journey.status}
Exit code: ${result.journey.exitCode ?? "none"}
Timed out: ${result.journey.timedOut ? "yes" : "no"}
Command: ${formatCommand(result)}

## Source

${source}

## Hooks

${hooks}

## Failure

Summary: ${result.failure.summary ?? "None"}
Command: ${result.failure.failedCommand ?? "None"}
Selector: ${result.failure.failedSelector ?? "None"}
Message: ${result.failure.message ?? "None"}

## Diagnosis

Class: ${result.diagnosis.failureClass}
Domain: ${result.diagnosis.failureDomain}
Suspicious changes: ${result.diagnosis.suspiciousChanges.length}
Matched signatures: ${result.diagnosis.matchedSignatures.length}

## Lifecycle Phases

${phases}

## Evidence

${evidence}

## Suggested Action

${result.diagnosis.suggestedAction}
`;
}

export function renderCompact(
  result: FinalResult,
  reportPath = result.reports.markdown,
  jsonPath = result.reports.json,
): string {
  const title =
    result.status === "passed"
      ? "PASSED"
      : result.status === "interrupted"
        ? "INTERRUPTED"
        : "FAILED";
  return `${title} ${result.flow.name ?? result.flow.path}
Outcome: ${result.outcome}

Report: ${reportPath}
JSON: ${jsonPath}
`;
}

function formatCommand(result: FinalResult): string {
  if (result.journey.command === null) {
    return "not run";
  }

  return [
    result.journey.command.executable,
    ...result.journey.command.arguments,
  ].join(" ");
}
