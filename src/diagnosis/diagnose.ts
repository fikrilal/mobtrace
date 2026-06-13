import type { ArtifactStore } from "../artifacts/store.js";
import type { FinalResult } from "../contracts/report.js";
import type { NormalizedEvidence } from "../evidence/normalized.js";
import { classifyFailure } from "./classify.js";
import type { DiagnosisContext } from "./context.js";
import { rankRetainedChanges } from "./rank.js";
import { matchSignatures } from "./signatures.js";

export async function diagnose(
  artifactStore: ArtifactStore,
  evidence: NormalizedEvidence,
  context: DiagnosisContext,
): Promise<FinalResult["diagnosis"]> {
  const classification = classifyFailure(evidence);
  const suspiciousChanges = await rankRetainedChanges(
    artifactStore,
    evidence,
    classification.failureClass,
    context,
  );
  const matchedSignatures = matchSignatures({
    context,
    evidence,
    failureClass: classification.failureClass,
    failureDomain: classification.failureDomain,
    suspiciousChanges,
  });

  return {
    failureClass: classification.failureClass,
    failureDomain: classification.failureDomain,
    matchedSignatures,
    suspiciousChanges,
    suggestedAction:
      matchedSignatures[0]?.action ?? classification.suggestedAction,
  };
}
