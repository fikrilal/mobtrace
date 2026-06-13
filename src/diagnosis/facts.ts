import type { ArtifactStore } from "../artifacts/store.js";
import type { NormalizedEvidence } from "../evidence/normalized.js";
import type { VerifyLifecycleResult } from "../verify/lifecycle.js";

export interface DirectFailureFacts {
  readonly failedCommand: string | null;
  readonly failedSelector: string | null;
  readonly message: string | null;
  readonly summary: string | null;
}

export async function extractFailureFacts(
  artifactStore: ArtifactStore,
  lifecycle: VerifyLifecycleResult,
): Promise<DirectFailureFacts> {
  if (lifecycle.runId.length === 0) {
    return emptyFacts();
  }

  const runnerText = await readRunnerText(artifactStore, lifecycle);
  if (lifecycle.journey.status === "failed") {
    const failedSelector = extractSelector(runnerText);
    const failedCommand =
      extractFailedCommand(runnerText) ??
      lifecycle.journey.command?.arguments.join(" ") ??
      null;
    const message =
      extractFailureMessage(runnerText) ??
      lifecycle.journey.error?.message ??
      "Journey failed.";

    return {
      failedCommand,
      failedSelector,
      message,
      summary:
        failedSelector === null
          ? "The mobile journey failed."
          : "The mobile journey failed while resolving an expected selector.",
    };
  }

  const failedPhase = lifecycle.phases.find(
    (phase) => phase.status === "failed",
  );
  if (failedPhase !== undefined) {
    const hook = lifecycle.hooks.find(
      (candidate) =>
        phaseForHook(candidate.id) === failedPhase.id &&
        candidate.status === "failed",
    );
    const hookText =
      hook === undefined
        ? ""
        : await readPaths(artifactStore, lifecycle.runId, [
            hook.stderr,
            hook.stdout,
          ]);
    return {
      failedCommand: failedPhase.id,
      failedSelector: null,
      message:
        extractFailureMessage(hookText) ??
        failedPhase.error?.message ??
        "Phase failed.",
      summary: "MobTrace could not complete every lifecycle phase.",
    };
  }

  return emptyFacts();
}

export function factsFromNormalized(
  evidence: NormalizedEvidence,
): DirectFailureFacts {
  return evidence.failure;
}

function emptyFacts(): DirectFailureFacts {
  return {
    failedCommand: null,
    failedSelector: null,
    message: null,
    summary: null,
  };
}

async function readRunnerText(
  artifactStore: ArtifactStore,
  lifecycle: VerifyLifecycleResult,
): Promise<string> {
  return readPaths(
    artifactStore,
    lifecycle.runId,
    [lifecycle.journey.stderr, lifecycle.journey.stdout].filter(
      (path): path is string => path !== null,
    ),
  );
}

async function readPaths(
  artifactStore: ArtifactStore,
  runId: string,
  paths: readonly string[],
): Promise<string> {
  const content = [];
  for (const path of paths) {
    try {
      content.push(await artifactStore.readText(runId, path));
    } catch (_error) {
      // Optional raw evidence may be missing on partial runs.
    }
  }
  return content.join("\n");
}

function extractSelector(text: string): string | null {
  const patterns = [
    /(?:element|selector|id)\s+(?:not found|was not visible|missing)[:\s]+["'`](.+?)["'`]/iu,
    /assertvisible\s*[:(]\s*["'`](.+?)["'`]/iu,
    /(?:element|selector)\s+["'`](.+?)["'`]\s+(?:not found|was not visible)/iu,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const selector = match?.[1]?.trim();
    if (selector !== undefined && selector.length > 0) {
      return selector;
    }
  }
  return null;
}

function extractFailedCommand(text: string): string | null {
  const match =
    /(?:failed command|command failed)[:\s]+([^\r\n]+)/iu.exec(text) ??
    /\b(assertVisible|tapOn|inputText|openLink|launchApp)\b/iu.exec(text);
  return match?.[1]?.trim() ?? null;
}

function extractFailureMessage(text: string): string | null {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const preferred = lines.find((line) =>
    /error|failed|not found|not visible|unauthori[sz]ed|http\s*[45]\d\d/iu.test(
      line,
    ),
  );
  return preferred ?? lines[0] ?? null;
}

function phaseForHook(
  id: VerifyLifecycleResult["hooks"][number]["id"],
): NormalizedEvidence["phases"][number]["id"] {
  switch (id) {
    case "project-prepare":
      return "prepare-project";
    case "flow-prepare":
      return "prepare-flow";
    case "flow-cleanup":
      return "cleanup-flow";
    case "project-cleanup":
      return "cleanup-project";
  }
}
