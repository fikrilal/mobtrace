import type { FinalResult } from "../contracts/report.js";
import type { NormalizedEvidence } from "../evidence/normalized.js";
import type { DiagnosisContext, DiagnosisSignature } from "./context.js";

const builtInSignatures: readonly DiagnosisSignature[] = [
  {
    action: "Compare the selector with the final visible hierarchy.",
    id: "assertion-false-missing-id",
    match: {
      failureClass: "selector-mismatch",
      message: "element (?:not found|was not visible)|assertvisible",
    },
    flags: "i",
  },
  {
    action:
      "Inspect the login request credentials, authorization response, and backend fixture identity.",
    id: "backend-unauthorized-after-login-submit",
    match: {
      failureClass: "backend-http-error",
      message: "401|unauthori[sz]ed",
    },
    flags: "i",
  },
  {
    action:
      "Inspect cleanup response handling and allow an empty successful response body when contracted.",
    id: "fixture-cleanup-empty-json-body",
    match: {
      failureClass: "fixture-cleanup-failed",
      message: "empty.*json|unexpected end of json",
    },
    flags: "i",
  },
  {
    action: "Restore the device connection before rerunning the journey.",
    id: "device-offline-before-run",
    match: {
      failureClass: "device-not-ready",
      message: "offline|not ready|unavailable",
    },
    flags: "i",
  },
];

export function matchSignatures(input: {
  readonly context: DiagnosisContext;
  readonly evidence: NormalizedEvidence;
  readonly failureClass: FinalResult["diagnosis"]["failureClass"];
  readonly failureDomain: FinalResult["diagnosis"]["failureDomain"];
  readonly suspiciousChanges: FinalResult["diagnosis"]["suspiciousChanges"];
}): FinalResult["diagnosis"]["matchedSignatures"] {
  return [...builtInSignatures, ...input.context.signatures]
    .filter((signature) => signatureMatches(signature, input))
    .map((signature) => ({
      action: signature.action,
      evidence: signatureEvidence(signature),
      id: signature.id,
    }));
}

function signatureMatches(
  signature: DiagnosisSignature,
  input: {
    readonly evidence: NormalizedEvidence;
    readonly failureClass: FinalResult["diagnosis"]["failureClass"];
    readonly failureDomain: FinalResult["diagnosis"]["failureDomain"];
    readonly suspiciousChanges: FinalResult["diagnosis"]["suspiciousChanges"];
  },
): boolean {
  const match = signature.match;
  if (
    match.failureClass !== undefined &&
    match.failureClass !== input.failureClass
  ) {
    return false;
  }
  if (
    match.failureDomain !== undefined &&
    match.failureDomain !== input.failureDomain
  ) {
    return false;
  }

  return (
    regexMatches(
      match.message,
      input.evidence.failure.message,
      signature.flags,
    ) &&
    regexMatches(
      match.failedCommand,
      input.evidence.failure.failedCommand,
      signature.flags,
    ) &&
    regexMatches(
      match.failedSelector,
      input.evidence.failure.failedSelector,
      signature.flags,
    ) &&
    changedPathMatches(
      match.changedPath,
      input.suspiciousChanges.map((change) => change.path),
      signature.flags,
    )
  );
}

function regexMatches(
  pattern: string | undefined,
  value: string | null,
  flags: string | undefined,
): boolean {
  if (pattern === undefined) {
    return true;
  }
  return value !== null && new RegExp(pattern, flags).test(value);
}

function changedPathMatches(
  pattern: string | undefined,
  paths: readonly string[],
  flags: string | undefined,
): boolean {
  if (pattern === undefined) {
    return true;
  }
  const regex = new RegExp(pattern, flags);
  return paths.some((path) => regex.test(path));
}

function signatureEvidence(signature: DiagnosisSignature): string[] {
  const evidence = ["normalized-evidence"];
  if (signature.match.changedPath !== undefined) {
    evidence.push("source-diff");
  }
  if (
    signature.match.message !== undefined ||
    signature.match.failedCommand !== undefined ||
    signature.match.failedSelector !== undefined
  ) {
    evidence.push("runner-result");
  }
  return [...new Set(evidence)];
}
