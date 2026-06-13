import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import { z } from "zod";

import type { ArtifactStore } from "../artifacts/store.js";
import type { ConfiguredHook } from "../configuration/schema.js";
import { parseDuration } from "../configuration/duration.js";
import { executeProcess } from "../process/execute.js";

export type HookId =
  | "flow-cleanup"
  | "flow-prepare"
  | "project-cleanup"
  | "project-prepare";

export type HookPhase = "cleanup" | "prepare";
export type HookScope = "flow" | "project";

export interface HookDefinition {
  readonly hook: ConfiguredHook;
  readonly id: HookId;
  readonly phase: HookPhase;
  readonly scope: HookScope;
}

export interface HookLifecycleInput {
  readonly artifactStore: ArtifactStore;
  readonly artifactsDir: string;
  readonly baseEnvironment?: ReadonlyMap<string, string>;
  readonly flowName: string | null;
  readonly flowPath: string;
  readonly flowCleanup?: ConfiguredHook | undefined;
  readonly flowPrepare?: ConfiguredHook | undefined;
  readonly inheritedEnv?: NodeJS.ProcessEnv;
  readonly journeyAttempted: boolean;
  readonly journeyStatus: "failed" | "interrupted" | "not-run" | "passed";
  readonly projectCleanup?: ConfiguredHook | undefined;
  readonly projectPrepare?: ConfiguredHook | undefined;
  readonly projectRoot: string;
  readonly redactionValues?: readonly string[];
  readonly runId: string;
}

export interface HookRunResult {
  readonly durationMs: number;
  readonly endedAt: string;
  readonly error: string | null;
  readonly exitCode: number | null;
  readonly exportedEnvironment: ReadonlyMap<string, string>;
  readonly exportedEnvironmentKeys: readonly string[];
  readonly id: HookId;
  readonly phase: HookPhase;
  readonly result: string;
  readonly scope: HookScope;
  readonly startedAt: string;
  readonly status: "failed" | "passed";
  readonly stderr: string;
  readonly stdout: string;
  readonly timedOut: boolean;
}

export interface HookExecutionInput {
  readonly artifactStore: ArtifactStore;
  readonly artifactsDir: string;
  readonly baseEnvironment?: ReadonlyMap<string, string>;
  readonly definition: HookDefinition;
  readonly exportedEnvironment: ReadonlyMap<string, string>;
  readonly flowName: string | null;
  readonly flowPath: string;
  readonly inheritedEnv?: NodeJS.ProcessEnv;
  readonly journeyStatus: "failed" | "interrupted" | "not-run" | "passed";
  readonly projectRoot: string;
  readonly redactionValues?: readonly string[];
  readonly runId: string;
}

export interface HookLifecycleResult {
  readonly exportedEnvironment: ReadonlyMap<string, string>;
  readonly failed: boolean;
  readonly results: readonly HookRunResult[];
}

const hookOutputSchema = z
  .object({
    environment: z
      .record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), z.string())
      .optional(),
  })
  .strict();

export async function executeHookLifecycle(
  input: HookLifecycleInput,
): Promise<HookLifecycleResult> {
  const results: HookRunResult[] = [];
  const exportedEnvironment = new Map<string, string>();
  const entered = {
    flow: false,
    project: false,
  };

  const projectPrepare = hookDefinition(
    "project-prepare",
    "prepare",
    "project",
    input.projectPrepare,
  );
  if (projectPrepare !== null) {
    const result = await executeHook({
      ...hookExecutionContext(input, exportedEnvironment),
      definition: projectPrepare,
    });
    results.push(result);
    mergeExports(exportedEnvironment, result.exportedEnvironment);
    entered.project = true;
    if (result.status === "failed") {
      await runCleanup(input, results, exportedEnvironment, entered);
      return finish(results, exportedEnvironment);
    }
  }

  const flowPrepare = hookDefinition(
    "flow-prepare",
    "prepare",
    "flow",
    input.flowPrepare,
  );
  if (flowPrepare !== null) {
    const result = await executeHook({
      ...hookExecutionContext(input, exportedEnvironment),
      definition: flowPrepare,
    });
    results.push(result);
    mergeExports(exportedEnvironment, result.exportedEnvironment);
    entered.flow = true;
    if (result.status === "failed") {
      await runCleanup(input, results, exportedEnvironment, entered);
      return finish(results, exportedEnvironment);
    }
  }

  if (input.journeyAttempted) {
    await runCleanup(input, results, exportedEnvironment, {
      flow: input.flowCleanup !== undefined,
      project: input.projectCleanup !== undefined,
    });
  }

  return finish(results, exportedEnvironment);
}

async function runCleanup(
  input: HookLifecycleInput,
  results: HookRunResult[],
  exportedEnvironment: Map<string, string>,
  entered: { readonly flow: boolean; readonly project: boolean },
): Promise<void> {
  const cleanupHooks = [
    hookDefinition("flow-cleanup", "cleanup", "flow", input.flowCleanup),
    hookDefinition(
      "project-cleanup",
      "cleanup",
      "project",
      input.projectCleanup,
    ),
  ].filter((hook): hook is HookDefinition => hook !== null);

  for (const hook of cleanupHooks) {
    if (!entered[hook.scope]) {
      continue;
    }
    results.push(
      await executeHook({
        ...hookExecutionContext(input, exportedEnvironment),
        definition: hook,
      }),
    );
  }
}

export async function executeHook(
  input: HookExecutionInput,
): Promise<HookRunResult> {
  const outputDir = await temporaryHookDirectory(
    input.runId,
    input.definition.id,
  );
  await mkdir(outputDir, { mode: 0o700, recursive: true });
  const hookOutput = join(outputDir, "hook-output.json");
  const [executable, ...args] = input.definition.hook.command;
  const resolvedExecutable = resolveExecutable(
    input.projectRoot,
    executable ?? "",
  );
  const redactionValues = [
    ...(input.redactionValues ?? []),
    ...input.exportedEnvironment.values(),
  ];
  const result = await executeProcess({
    args,
    cwd: input.projectRoot,
    env: {
      ...(input.inheritedEnv ?? process.env),
      ...Object.fromEntries(input.baseEnvironment ?? new Map()),
      ...Object.fromEntries(input.exportedEnvironment),
      MOBTRACE_ARTIFACTS_DIR: input.artifactsDir,
      MOBTRACE_FLOW_NAME: input.flowName ?? "",
      MOBTRACE_FLOW_PATH: input.flowPath,
      MOBTRACE_HOOK_OUTPUT: hookOutput,
      MOBTRACE_HOOK_PHASE: input.definition.phase,
      MOBTRACE_JOURNEY_STATUS:
        input.definition.phase === "cleanup" ? input.journeyStatus : "",
      MOBTRACE_PROJECT_ROOT: input.projectRoot,
      MOBTRACE_RUN_ID: input.runId,
    },
    executable: resolvedExecutable,
    redaction: {
      values: redactionValues,
    },
    timeoutMs:
      input.definition.hook.timeout === undefined
        ? defaultTimeout(input.definition.phase)
        : parseDuration(input.definition.hook.timeout).milliseconds,
  });

  let exported = new Map<string, string>();
  let outputError: string | null = null;
  if (
    input.definition.phase === "prepare" &&
    result.exitCode === 0 &&
    !result.timedOut
  ) {
    try {
      exported = new Map(await readHookOutput(hookOutput));
    } catch (error) {
      outputError = `Invalid hook output: ${messageFor(error)}`;
    }
  }
  await rm(hookOutput, { force: true }).catch(() => undefined);
  await rm(outputDir, { force: true, recursive: true }).catch(() => undefined);

  const stdoutPath = await input.artifactStore.writeText(
    input.runId,
    `hooks/${input.definition.id}/stdout.log`,
    result.stdout,
  );
  const stderrPath = await input.artifactStore.writeText(
    input.runId,
    `hooks/${input.definition.id}/stderr.log`,
    result.stderr,
  );
  const status =
    result.exitCode === 0 && !result.timedOut && outputError === null
      ? "passed"
      : "failed";
  const output = {
    schemaVersion: 1,
    command: result.command,
    durationMs: result.durationMs,
    endedAt: result.endedAt,
    error: outputError ?? result.error,
    exitCode: result.exitCode,
    exportedEnvironmentKeys: [...exported.keys()].sort(),
    id: input.definition.id,
    phase: input.definition.phase,
    scope: input.definition.scope,
    startedAt: result.startedAt,
    status,
    stderr: stderrPath,
    stderrBytes: result.stderrBytes,
    stderrTruncated: result.stderrTruncated,
    stdout: stdoutPath,
    stdoutBytes: result.stdoutBytes,
    stdoutTruncated: result.stdoutTruncated,
    timedOut: result.timedOut,
  };
  const resultPath = await input.artifactStore.writeJson(
    input.runId,
    `hooks/${input.definition.id}/result.json`,
    output,
  );

  return {
    durationMs: result.durationMs,
    endedAt: result.endedAt,
    error: output.error,
    exitCode: result.exitCode,
    exportedEnvironment: exported,
    exportedEnvironmentKeys: output.exportedEnvironmentKeys,
    id: input.definition.id,
    phase: input.definition.phase,
    result: resultPath,
    scope: input.definition.scope,
    startedAt: result.startedAt,
    status,
    stderr: stderrPath,
    stdout: stdoutPath,
    timedOut: result.timedOut,
  };
}

export function hookDefinition(
  id: HookId,
  phase: HookPhase,
  scope: HookScope,
  hook: ConfiguredHook | undefined,
): HookDefinition | null {
  return hook === undefined ? null : { hook, id, phase, scope };
}

function finish(
  results: readonly HookRunResult[],
  exportedEnvironment: ReadonlyMap<string, string>,
): HookLifecycleResult {
  return {
    exportedEnvironment: new Map(exportedEnvironment),
    failed: results.some((result) => result.status === "failed"),
    results: Object.freeze([...results]),
  };
}

function mergeExports(
  target: Map<string, string>,
  source: ReadonlyMap<string, string>,
): void {
  for (const [key, value] of source) {
    target.set(key, value);
  }
}

function hookExecutionContext(
  input: HookLifecycleInput,
  exportedEnvironment: ReadonlyMap<string, string>,
): Omit<HookExecutionInput, "definition"> {
  return {
    artifactStore: input.artifactStore,
    artifactsDir: input.artifactsDir,
    exportedEnvironment,
    flowName: input.flowName,
    flowPath: input.flowPath,
    journeyStatus: input.journeyStatus,
    projectRoot: input.projectRoot,
    runId: input.runId,
    ...(input.baseEnvironment === undefined
      ? {}
      : { baseEnvironment: input.baseEnvironment }),
    ...(input.inheritedEnv === undefined
      ? {}
      : { inheritedEnv: input.inheritedEnv }),
    ...(input.redactionValues === undefined
      ? {}
      : { redactionValues: input.redactionValues }),
  };
}

function resolveExecutable(projectRoot: string, executable: string): string {
  if (executable.includes("/") || executable.includes("\\")) {
    return isAbsolute(executable)
      ? executable
      : resolve(projectRoot, executable);
  }

  return executable;
}

async function temporaryHookDirectory(
  runId: string,
  hookId: HookId,
): Promise<string> {
  return join(tmpdir(), `mobtrace-${runId}-${hookId}`);
}

async function readHookOutput(
  path: string,
): Promise<ReadonlyMap<string, string>> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return new Map();
    }
    throw error;
  }

  if (content.trim().length === 0) {
    return new Map();
  }

  const parsed = hookOutputSchema.parse(JSON.parse(content));
  return new Map(Object.entries(parsed.environment ?? {}));
}

function defaultTimeout(phase: HookPhase): number {
  return phase === "prepare" ? 60_000 : 60_000;
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}
