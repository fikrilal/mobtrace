import { ArtifactStore } from "../artifacts/store.js";
import type {
  PhaseId,
  PhaseResult,
  PhaseStatus,
  PrimaryOutcome,
  OverallStatus,
} from "../contracts/report.js";
import type { ConfigurationDiscovery } from "../configuration/load.js";
import {
  type ResolvedEnvironmentEntry,
  type ResolvedFlowInvocation,
  resolveFlowInvocation,
} from "../configuration/resolve.js";
import { executeHook, hookDefinition } from "../hooks/lifecycle.js";
import type { HookRunResult } from "../hooks/lifecycle.js";
import { executeProcess } from "../process/execute.js";
import {
  captureGitSourceEvidence,
  type SourceEvidence,
} from "../source/git.js";

export interface JourneyExecutionInput {
  readonly artifactStore: ArtifactStore;
  readonly environment: ReadonlyMap<string, string>;
  readonly flow: ResolvedFlowInvocation;
  readonly projectRoot: string;
  readonly runDirectory: string;
  readonly runId: string;
}

export interface JourneyExecutionResult {
  readonly command: {
    readonly arguments: readonly string[];
    readonly executable: string;
  } | null;
  readonly durationMs: number | null;
  readonly endedAt: string | null;
  readonly error: {
    readonly code: string;
    readonly message: string;
  } | null;
  readonly exitCode: number | null;
  readonly result: string | null;
  readonly startedAt: string | null;
  readonly status: "failed" | "interrupted" | "not-run" | "passed";
  readonly stderr: string | null;
  readonly stdout: string | null;
  readonly timedOut: boolean;
}

export interface JourneyRunner {
  run(input: JourneyExecutionInput): Promise<JourneyExecutionResult>;
}

export interface VerifyLifecycleInput {
  readonly artifactOverride?: string | undefined;
  readonly baseline?: string | undefined;
  readonly configuration: ConfigurationDiscovery;
  readonly device?: string | undefined;
  readonly flow: string;
  readonly journeyRunner: JourneyRunner;
  readonly projectRoot: string;
}

export interface VerifyLifecycleResult {
  readonly exitCode: number;
  readonly flow: ResolvedFlowInvocation;
  readonly hooks: readonly HookRunResult[];
  readonly journey: JourneyExecutionResult;
  readonly outcome: PrimaryOutcome;
  readonly phases: readonly PhaseResult[];
  readonly runDirectory: string;
  readonly runId: string;
  readonly source: SourceEvidence;
  readonly status: OverallStatus;
}

export async function runVerifyLifecycle(
  input: VerifyLifecycleInput,
): Promise<VerifyLifecycleResult> {
  const phases: PhaseResult[] = [];
  const validation = phaseBuilder("validation");

  const flow = await resolveFlowInvocation(
    input.projectRoot,
    input.configuration,
    {
      baseline: input.baseline,
      device: input.device,
      flow: input.flow,
    },
  );
  const artifactStore = new ArtifactStore(
    input.artifactOverride ?? flow.artifactRoot,
  );
  const run = await artifactStore.initializeRun({
    deviceId: flow.device ?? null,
    flowName: flow.flowName,
    flowPath: flow.flowPathRelative,
    flowResolution: flow.resolution,
  });
  phases.push(validation.pass());

  const baseline = flow.baseline ?? (await defaultBaseline(input.projectRoot));
  const sourcePhase = phaseBuilder("source");
  let source: SourceEvidence;
  try {
    source = await captureGitSourceEvidence({
      artifactStore,
      baseline,
      projectRoot: input.projectRoot,
      runId: run.manifest.runId,
    });
    phases.push(
      source.available
        ? sourcePhase.pass([
            "source-metadata",
            "source-changed-files",
            "source-diff",
          ])
        : sourcePhase.skip(source.reason),
    );
  } catch (error) {
    phases.push(sourcePhase.fail("source-capture-failed", messageFor(error)));
    const result = await finalizeLifecycle({
      artifactStore,
      flow,
      hooks: [],
      journey: notRunJourney(),
      phases,
      runDirectory: run.directory,
      runId: run.manifest.runId,
      source: { available: false, reason: "source-capture-failed" },
    });
    return result;
  }

  const environment = environmentMap(flow.environment);
  const redactionValues = sensitiveValues(flow.environment);
  const hooks: HookRunResult[] = [];
  const exportedEnvironment = new Map<string, string>();

  const projectPrepare = hookDefinition(
    "project-prepare",
    "prepare",
    "project",
    flow.projectHooks?.prepare,
  );
  const projectPreparePhase = phaseBuilder("prepare-project");
  if (projectPrepare === null) {
    phases.push(
      projectPreparePhase.skip("No project prepare hook configured."),
    );
  } else {
    const hook = await executeHook({
      artifactStore,
      artifactsDir: run.directory,
      baseEnvironment: environment,
      definition: projectPrepare,
      exportedEnvironment,
      flowName: flow.flowName,
      flowPath: flow.flowPath,
      journeyStatus: "not-run",
      projectRoot: input.projectRoot,
      redactionValues,
      runId: run.manifest.runId,
    });
    hooks.push(hook);
    mergeExports(exportedEnvironment, hook.exportedEnvironment);
    phases.push(phaseFromHook(projectPreparePhase, hook));
    if (hook.status === "failed") {
      await cleanupEntered({
        artifactStore,
        environment,
        exportedEnvironment,
        flow,
        hooks,
        journeyStatus: "not-run",
        phases,
        projectRoot: input.projectRoot,
        redactionValues,
        runDirectory: run.directory,
        runId: run.manifest.runId,
        runProjectCleanup: true,
        runFlowCleanup: false,
      });
      return finalizeLifecycle({
        artifactStore,
        flow,
        hooks,
        journey: notRunJourney(),
        phases,
        runDirectory: run.directory,
        runId: run.manifest.runId,
        source,
      });
    }
  }

  const flowPrepare = hookDefinition(
    "flow-prepare",
    "prepare",
    "flow",
    flow.flowHooks?.prepare,
  );
  const flowPreparePhase = phaseBuilder("prepare-flow");
  if (flowPrepare === null) {
    phases.push(flowPreparePhase.skip("No flow prepare hook configured."));
  } else {
    const hook = await executeHook({
      artifactStore,
      artifactsDir: run.directory,
      baseEnvironment: environment,
      definition: flowPrepare,
      exportedEnvironment,
      flowName: flow.flowName,
      flowPath: flow.flowPath,
      journeyStatus: "not-run",
      projectRoot: input.projectRoot,
      redactionValues,
      runId: run.manifest.runId,
    });
    hooks.push(hook);
    mergeExports(exportedEnvironment, hook.exportedEnvironment);
    phases.push(phaseFromHook(flowPreparePhase, hook));
    if (hook.status === "failed") {
      await cleanupEntered({
        artifactStore,
        environment,
        exportedEnvironment,
        flow,
        hooks,
        journeyStatus: "not-run",
        phases,
        projectRoot: input.projectRoot,
        redactionValues,
        runDirectory: run.directory,
        runId: run.manifest.runId,
        runProjectCleanup: true,
        runFlowCleanup: true,
      });
      return finalizeLifecycle({
        artifactStore,
        flow,
        hooks,
        journey: notRunJourney(),
        phases,
        runDirectory: run.directory,
        runId: run.manifest.runId,
        source,
      });
    }
  }

  const journey = await input.journeyRunner.run({
    artifactStore,
    environment: new Map([...environment, ...exportedEnvironment]),
    flow,
    projectRoot: input.projectRoot,
    runDirectory: run.directory,
    runId: run.manifest.runId,
  });
  phases.push(phaseFromJourney(journey));

  await cleanupEntered({
    artifactStore,
    environment,
    exportedEnvironment,
    flow,
    hooks,
    journeyStatus: journey.status,
    phases,
    projectRoot: input.projectRoot,
    redactionValues,
    runDirectory: run.directory,
    runId: run.manifest.runId,
    runProjectCleanup: flow.projectHooks?.cleanup !== undefined,
    runFlowCleanup: flow.flowHooks?.cleanup !== undefined,
  });

  return finalizeLifecycle({
    artifactStore,
    flow,
    hooks,
    journey,
    phases,
    runDirectory: run.directory,
    runId: run.manifest.runId,
    source,
  });
}

async function cleanupEntered(input: {
  readonly artifactStore: ArtifactStore;
  readonly environment: ReadonlyMap<string, string>;
  readonly exportedEnvironment: ReadonlyMap<string, string>;
  readonly flow: ResolvedFlowInvocation;
  readonly hooks: HookRunResult[];
  readonly journeyStatus: JourneyExecutionResult["status"];
  readonly phases: PhaseResult[];
  readonly projectRoot: string;
  readonly redactionValues: readonly string[];
  readonly runDirectory: string;
  readonly runFlowCleanup: boolean;
  readonly runId: string;
  readonly runProjectCleanup: boolean;
}): Promise<void> {
  const flowCleanupPhase = phaseBuilder("cleanup-flow");
  const flowCleanup = hookDefinition(
    "flow-cleanup",
    "cleanup",
    "flow",
    input.flow.flowHooks?.cleanup,
  );
  if (flowCleanup === null || !input.runFlowCleanup) {
    input.phases.push(
      flowCleanupPhase.skip("No flow cleanup hook configured."),
    );
  } else {
    const hook = await executeHook({
      artifactStore: input.artifactStore,
      artifactsDir: input.runDirectory,
      baseEnvironment: input.environment,
      definition: flowCleanup,
      exportedEnvironment: input.exportedEnvironment,
      flowName: input.flow.flowName,
      flowPath: input.flow.flowPath,
      journeyStatus: input.journeyStatus,
      projectRoot: input.projectRoot,
      redactionValues: input.redactionValues,
      runId: input.runId,
    });
    input.hooks.push(hook);
    input.phases.push(phaseFromHook(flowCleanupPhase, hook));
  }

  const projectCleanupPhase = phaseBuilder("cleanup-project");
  const projectCleanup = hookDefinition(
    "project-cleanup",
    "cleanup",
    "project",
    input.flow.projectHooks?.cleanup,
  );
  if (projectCleanup === null || !input.runProjectCleanup) {
    input.phases.push(
      projectCleanupPhase.skip("No project cleanup hook configured."),
    );
  } else {
    const hook = await executeHook({
      artifactStore: input.artifactStore,
      artifactsDir: input.runDirectory,
      baseEnvironment: input.environment,
      definition: projectCleanup,
      exportedEnvironment: input.exportedEnvironment,
      flowName: input.flow.flowName,
      flowPath: input.flow.flowPath,
      journeyStatus: input.journeyStatus,
      projectRoot: input.projectRoot,
      redactionValues: input.redactionValues,
      runId: input.runId,
    });
    input.hooks.push(hook);
    input.phases.push(phaseFromHook(projectCleanupPhase, hook));
  }
}

async function finalizeLifecycle(input: {
  readonly artifactStore: ArtifactStore;
  readonly flow: ResolvedFlowInvocation;
  readonly hooks: readonly HookRunResult[];
  readonly journey: JourneyExecutionResult;
  readonly phases: readonly PhaseResult[];
  readonly runDirectory: string;
  readonly runId: string;
  readonly source: SourceEvidence;
}): Promise<VerifyLifecycleResult> {
  const exit = classifyExit(input.journey, input.phases);
  await input.artifactStore.updateManifest(input.runId, {
    phases: input.phases,
    sourceControl: input.source.available ? "git" : null,
    state: "completed",
  });

  return {
    exitCode: exit.exitCode,
    flow: input.flow,
    hooks: input.hooks,
    journey: input.journey,
    outcome: exit.outcome,
    phases: input.phases,
    runDirectory: input.runDirectory,
    runId: input.runId,
    source: input.source,
    status: exit.status,
  };
}

function classifyExit(
  journey: JourneyExecutionResult,
  phases: readonly PhaseResult[],
): {
  readonly exitCode: number;
  readonly outcome: PrimaryOutcome;
  readonly status: OverallStatus;
} {
  if (journey.status === "failed") {
    return { exitCode: 1, outcome: "journey-failed", status: "failed" };
  }

  const preparationFailed = phases.some(
    (phase) =>
      (phase.id === "prepare-project" || phase.id === "prepare-flow") &&
      phase.status === "failed",
  );
  if (preparationFailed) {
    return { exitCode: 3, outcome: "preparation-failed", status: "error" };
  }

  const cleanupFailed = phases.some(
    (phase) =>
      (phase.id === "cleanup-project" || phase.id === "cleanup-flow") &&
      phase.status === "failed",
  );
  if (cleanupFailed) {
    return { exitCode: 4, outcome: "cleanup-failed", status: "error" };
  }

  const infrastructureFailed = phases.some(
    (phase) =>
      (phase.id === "source" || phase.id === "journey") &&
      phase.status === "failed",
  );
  if (infrastructureFailed) {
    return { exitCode: 3, outcome: "infrastructure-failed", status: "error" };
  }

  return { exitCode: 0, outcome: "verified-pass", status: "passed" };
}

function phaseBuilder(id: PhaseId): {
  fail(code: string, message: string, exitCode?: number | null): PhaseResult;
  pass(evidence?: readonly string[], exitCode?: number | null): PhaseResult;
  skip(reason: string): PhaseResult;
} {
  const startedAt = new Date();
  return {
    fail: (code, message, exitCode = null) =>
      phaseResult(id, "failed", startedAt, {
        error: { code, message },
        exitCode,
      }),
    pass: (evidence = [], exitCode = null) =>
      phaseResult(id, "passed", startedAt, { evidence, exitCode }),
    skip: (reason) =>
      phaseResult(id, "skipped", startedAt, {
        error: { code: "not-applicable", message: reason },
      }),
  };
}

function phaseResult(
  id: PhaseId,
  status: PhaseStatus,
  startedAt: Date,
  options: {
    readonly error?: PhaseResult["error"];
    readonly evidence?: readonly string[];
    readonly exitCode?: number | null;
    readonly timedOut?: boolean;
  } = {},
): PhaseResult {
  const endedAt = new Date();
  return {
    durationMs: Math.max(0, endedAt.getTime() - startedAt.getTime()),
    endedAt: endedAt.toISOString(),
    error: options.error ?? null,
    evidence: [...(options.evidence ?? [])],
    exitCode: options.exitCode ?? null,
    id,
    startedAt: startedAt.toISOString(),
    status,
    timedOut: options.timedOut ?? false,
  };
}

function phaseFromHook(
  builder: ReturnType<typeof phaseBuilder>,
  hook: HookRunResult,
): PhaseResult {
  return hook.status === "passed"
    ? builder.pass([`${hook.id}-result`], hook.exitCode)
    : builder.fail(
        hook.timedOut ? "hook-timeout" : "hook-failed",
        `${hook.id} failed.`,
        hook.exitCode,
      );
}

function phaseFromJourney(journey: JourneyExecutionResult): PhaseResult {
  const startedAt =
    journey.startedAt === null ? new Date() : new Date(journey.startedAt);
  if (journey.status === "passed") {
    return phaseResult("journey", "passed", startedAt, {
      evidence: ["runner-result"],
      exitCode: journey.exitCode,
      timedOut: journey.timedOut,
    });
  }
  if (journey.status === "failed") {
    return phaseResult("journey", "failed", startedAt, {
      error: journey.error ?? {
        code: "runner-exit-nonzero",
        message: "Journey failed.",
      },
      evidence: ["runner-result"],
      exitCode: journey.exitCode,
      timedOut: journey.timedOut,
    });
  }
  return phaseResult("journey", "skipped", startedAt, {
    error: { code: "journey-not-run", message: "Journey did not run." },
  });
}

function notRunJourney(): JourneyExecutionResult {
  return {
    command: null,
    durationMs: null,
    endedAt: null,
    error: null,
    exitCode: null,
    result: null,
    startedAt: null,
    status: "not-run",
    stderr: null,
    stdout: null,
    timedOut: false,
  };
}

function environmentMap(
  environment: ReadonlyMap<string, ResolvedEnvironmentEntry>,
): ReadonlyMap<string, string> {
  return new Map(
    [...environment.entries()].map(([key, entry]) => [key, entry.value]),
  );
}

function sensitiveValues(
  environment: ReadonlyMap<string, ResolvedEnvironmentEntry>,
): readonly string[] {
  return [...environment.values()]
    .filter((entry) => entry.sensitive)
    .map((entry) => entry.value);
}

function mergeExports(
  target: Map<string, string>,
  source: ReadonlyMap<string, string>,
): void {
  for (const [key, value] of source) {
    target.set(key, value);
  }
}

async function defaultBaseline(projectRoot: string): Promise<string> {
  const parent = await executeProcess({
    args: ["rev-parse", "HEAD^"],
    cwd: projectRoot,
    executable: "git",
  });
  return parent.exitCode === 0 ? "HEAD^" : "HEAD";
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}
