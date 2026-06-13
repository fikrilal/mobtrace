import { z } from "zod";

import type { ArtifactStore } from "../artifacts/store.js";
import type { FinalResult, FailureClass } from "../contracts/report.js";
import type { NormalizedEvidence } from "../evidence/normalized.js";

const changedFileSchema = z.object({
  path: z.string().min(1),
  previousPath: z.string().min(1).optional(),
  staged: z.boolean(),
  status: z.string().min(1),
  unstaged: z.boolean(),
});

const changedFilesSchema = z.array(changedFileSchema);

interface RankingReason {
  readonly code: string;
  readonly evidence: readonly string[];
  readonly message: string;
  readonly score: number;
}

interface RankedCandidate {
  readonly path: string;
  readonly reasons: readonly RankingReason[];
  readonly score: number;
}

export async function rankRetainedChanges(
  artifactStore: ArtifactStore,
  evidence: NormalizedEvidence,
  failureClass: FailureClass,
): Promise<FinalResult["diagnosis"]["suspiciousChanges"]> {
  if (!evidence.source.available || failureClass === "none") {
    return [];
  }

  let changedFiles: z.infer<typeof changedFilesSchema>;
  let diff: string;
  try {
    changedFiles = changedFilesSchema.parse(
      await artifactStore.readJson(
        evidence.run.runId,
        evidence.source.changedFiles,
      ),
    );
    diff = await artifactStore.readText(
      evidence.run.runId,
      evidence.source.diff,
    );
  } catch (_error) {
    return [];
  }

  return rankSuspiciousChanges({
    changedFiles,
    diff,
    failedSelector: evidence.failure.failedSelector,
    failureClass,
  });
}

export function rankSuspiciousChanges(input: {
  readonly changedFiles: readonly z.infer<typeof changedFileSchema>[];
  readonly diff: string;
  readonly failedSelector: string | null;
  readonly failureClass: FailureClass;
}): FinalResult["diagnosis"]["suspiciousChanges"] {
  const hunks = splitDiffByPath(input.diff);
  const candidates = input.changedFiles.map((file) => {
    const content = hunks.get(file.path) ?? "";
    const reasons = reasonsFor({
      content,
      failedSelector: input.failedSelector,
      failureClass: input.failureClass,
      path: file.path,
    });
    return {
      path: file.path,
      reasons,
      score: reasons.reduce((total, reason) => total + reason.score, 0),
    };
  });

  return candidates
    .sort(compareCandidates)
    .slice(0, 10)
    .map((candidate, index) => ({
      path: candidate.path,
      rank: index + 1,
      reasons: candidate.reasons.map(({ code, evidence, message }) => ({
        code,
        evidence: [...evidence],
        message,
      })),
    }));
}

function reasonsFor(input: {
  readonly content: string;
  readonly failedSelector: string | null;
  readonly failureClass: FailureClass;
  readonly path: string;
}): readonly RankingReason[] {
  const reasons: RankingReason[] = [];
  const lowerPath = input.path.toLowerCase();
  const lowerContent = input.content.toLowerCase();

  if (
    input.failureClass === "selector-mismatch" &&
    input.failedSelector !== null &&
    lowerContent.includes(input.failedSelector.toLowerCase())
  ) {
    reasons.push(
      reason(
        "changed-selector",
        100,
        "The failed selector appears in this changed diff hunk.",
      ),
    );
  }
  if (
    input.failureClass === "selector-mismatch" &&
    lowerPath.includes(".maestro/")
  ) {
    reasons.push(
      reason(
        "changed-flow",
        40,
        "This changed Maestro flow may contain the failed assertion.",
      ),
    );
  }
  if (
    input.failureClass === "selector-mismatch" &&
    /semantics|test.?id|key\(|accessibility|contentdescription/u.test(
      lowerContent,
    )
  ) {
    reasons.push(
      reason(
        "changed-test-identifier",
        35,
        "This hunk changes a semantics or test identifier.",
      ),
    );
  }

  if (
    input.failureClass === "backend-http-error" &&
    /endpoint|baseurl|https?:|payload|request|response|body|json|authorization/u.test(
      lowerContent,
    )
  ) {
    reasons.push(
      reason(
        "changed-api-contract",
        70,
        "This hunk changes API endpoint, payload, or response handling.",
      ),
    );
  }
  if (
    input.failureClass === "backend-http-error" &&
    /repository|data|api|client|remote/u.test(lowerPath)
  ) {
    reasons.push(
      reason(
        "api-layer-path",
        30,
        "This changed file is located in an API or data boundary.",
      ),
    );
  }

  if (
    input.failureClass === "app-did-not-navigate" &&
    /route|router|navigate|navigation|redirect|session|auth.?guard/u.test(
      lowerContent,
    )
  ) {
    reasons.push(
      reason(
        "changed-navigation-session",
        70,
        "This hunk changes navigation, route, or session behavior.",
      ),
    );
  }
  if (
    input.failureClass === "app-did-not-navigate" &&
    /navigation|route|session|auth/u.test(lowerPath)
  ) {
    reasons.push(
      reason(
        "navigation-layer-path",
        30,
        "This changed file is in a navigation or session boundary.",
      ),
    );
  }

  if (
    (input.failureClass === "fixture-setup-failed" ||
      input.failureClass === "fixture-cleanup-failed") &&
    /fixture|cleanup|delete|seed|test.?user|reset/u.test(
      `${lowerPath}\n${lowerContent}`,
    )
  ) {
    reasons.push(
      reason(
        "changed-fixture-lifecycle",
        70,
        "This change affects fixture preparation or cleanup behavior.",
      ),
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      reason(
        "changed-file",
        1,
        "This file changed in the source state associated with the failure.",
      ),
    );
  }

  return reasons;
}

function reason(code: string, score: number, message: string): RankingReason {
  return {
    code,
    evidence: ["source-diff", "runner-result"],
    message,
    score,
  };
}

function compareCandidates(
  left: RankedCandidate,
  right: RankedCandidate,
): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
}

function splitDiffByPath(diff: string): ReadonlyMap<string, string> {
  const hunks = new Map<string, string>();
  let currentPath: string | null = null;
  let content: string[] = [];

  const flush = (): void => {
    if (currentPath !== null) {
      hunks.set(currentPath, content.join("\n"));
    }
  };

  for (const line of diff.split("\n")) {
    const match = /^diff --git a\/(.+?) b\/(.+)$/u.exec(line);
    if (match !== null) {
      flush();
      currentPath = match[2] ?? match[1] ?? null;
      content = [line];
      continue;
    }
    if (currentPath !== null) {
      content.push(line);
    }
  }
  flush();

  return hunks;
}
