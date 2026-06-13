import type { FailureClass, FailureDomain } from "../contracts/report.js";
import type { NormalizedEvidence } from "../evidence/normalized.js";

export interface FailureClassification {
  readonly failureClass: FailureClass;
  readonly failureDomain: FailureDomain;
  readonly suggestedAction: string;
}

export function classifyFailure(
  evidence: NormalizedEvidence,
): FailureClassification {
  if (evidence.run.status === "passed") {
    return {
      failureClass: "none",
      failureDomain: "none",
      suggestedAction:
        "No failure detected. Keep this run as baseline evidence.",
    };
  }

  const text = [
    evidence.failure.summary,
    evidence.failure.failedCommand,
    evidence.failure.failedSelector,
    evidence.failure.message,
    evidence.journey.error?.message,
  ]
    .filter((value): value is string => value !== null && value !== undefined)
    .join("\n")
    .toLowerCase();

  if (evidence.journey.timedOut) {
    return classification(
      "runner-timeout",
      "infrastructure",
      "Inspect runner logs and verify the device and app reached a responsive state.",
    );
  }
  if (matches(text, /device.*(?:offline|not ready|unavailable)|no devices?/u)) {
    return classification(
      "device-not-ready",
      "infrastructure",
      "Restore the requested device and rerun the journey.",
    );
  }
  if (
    matches(
      text,
      /(?:maestro|runner).*(?:not found|unavailable|failed to start)|\benoent\b/u,
    )
  ) {
    return classification(
      "runner-unavailable",
      "infrastructure",
      "Install Maestro or correct the configured executable path.",
    );
  }
  if (
    failedPhase(evidence, "prepare-project") ||
    failedPhase(evidence, "prepare-flow")
  ) {
    return classification(
      "fixture-setup-failed",
      inferFixtureDomain(text),
      "Inspect the failed preparation hook and its retained logs.",
    );
  }
  if (
    evidence.journey.status !== "failed" &&
    (failedPhase(evidence, "cleanup-project") ||
      failedPhase(evidence, "cleanup-flow"))
  ) {
    return classification(
      "fixture-cleanup-failed",
      inferFixtureDomain(text),
      "Inspect the failed cleanup hook and verify fixture deletion behavior.",
    );
  }
  if (
    matches(
      text,
      /\bhttp\b.*\b(?:4\d\d|5\d\d)\b|\b(?:401|403|404|409|422|500|502|503)\b|unauthori[sz]ed/u,
    )
  ) {
    return classification(
      "backend-http-error",
      "backend",
      "Inspect the backend response, endpoint, and request payload contract.",
    );
  }
  if (
    evidence.failure.failedSelector !== null ||
    matches(
      text,
      /assertvisible|element (?:not found|was not visible)|selector.*(?:not found|missing)/u,
    )
  ) {
    return classification(
      "selector-mismatch",
      "test-harness",
      "Compare the expected selector with the final visible hierarchy.",
    );
  }
  if (
    matches(
      text,
      /input.*(?:not applied|did not change|stayed)|text.*(?:not entered|unchanged)/u,
    )
  ) {
    return classification(
      "input-not-applied",
      "test-harness",
      "Inspect the input target, focus state, and final field value.",
    );
  }
  if (
    matches(
      text,
      /did not navigate|navigation.*failed|stayed on.*screen|route.*not reached/u,
    )
  ) {
    return classification(
      "app-did-not-navigate",
      "application",
      "Inspect navigation, route guards, and session state after the triggering action.",
    );
  }
  if (
    evidence.run.outcome === "processing-failed" ||
    failedPhase(evidence, "normalize") ||
    failedPhase(evidence, "report")
  ) {
    return classification(
      "processing-error",
      "infrastructure",
      "Inspect MobTrace normalization and report-generation evidence.",
    );
  }
  if (
    evidence.journey.status === "failed" &&
    evidence.journey.exitCode !== null
  ) {
    return classification(
      "unknown",
      "unknown",
      "Inspect retained runner output before choosing app, harness, or backend code to edit.",
    );
  }
  if (evidence.journey.status === "failed") {
    return classification(
      "runner-error",
      "infrastructure",
      "Inspect the runner result and launch diagnostics.",
    );
  }
  return classification(
    "unknown",
    "unknown",
    "Inspect retained lifecycle evidence before selecting a code change.",
  );
}

function classification(
  failureClass: FailureClass,
  failureDomain: FailureDomain,
  suggestedAction: string,
): FailureClassification {
  return { failureClass, failureDomain, suggestedAction };
}

function failedPhase(
  evidence: NormalizedEvidence,
  id: NormalizedEvidence["phases"][number]["id"],
): boolean {
  return evidence.phases.some(
    (phase) => phase.id === id && phase.status === "failed",
  );
}

function inferFixtureDomain(text: string): FailureDomain {
  return matches(
    text,
    /http|response|json|database|backend|unauthori[sz]ed|\b(?:4\d\d|5\d\d)\b/u,
  )
    ? "backend"
    : "test-harness";
}

function matches(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}
