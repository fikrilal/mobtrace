import * as z from "zod";

import type { ArtifactStore } from "../artifacts/store.js";
import {
  flowResolutionSchema,
  overallStatusSchema,
  phaseResultSchema,
  portablePathSchema,
  primaryOutcomeSchema,
  runIdSchema,
} from "../contracts/report.js";
import { extractFailureFacts } from "../diagnosis/facts.js";
import type { VerifyLifecycleResult } from "../verify/lifecycle.js";

const timestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
const objectIdSchema = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);

const sourceSchema = z.discriminatedUnion("available", [
  z.object({
    available: z.literal(true),
    baseline: z.string().min(1),
    baselineCommit: objectIdSchema,
    branch: z.string().min(1).nullable(),
    changedFileCount: z.number().int().nonnegative(),
    changedFiles: portablePathSchema,
    diff: portablePathSchema,
    dirty: z.boolean(),
    head: objectIdSchema,
    metadata: portablePathSchema,
    untrackedFileCount: z.number().int().nonnegative(),
  }),
  z.object({
    available: z.literal(false),
    reason: z.string().min(1),
  }),
]);

const commandSchema = z.object({
  arguments: z.array(z.string()),
  executable: z.string().min(1),
});

const journeySchema = z.object({
  command: commandSchema.nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  endedAt: timestampSchema.nullable(),
  error: z
    .object({
      code: z.string().min(1),
      message: z.string().min(1),
    })
    .nullable(),
  exitCode: z.number().int().nullable(),
  result: portablePathSchema.nullable(),
  startedAt: timestampSchema.nullable(),
  status: z.enum(["failed", "interrupted", "not-run", "passed"]),
  stderr: portablePathSchema.nullable(),
  stdout: portablePathSchema.nullable(),
  timedOut: z.boolean(),
});

const hookSchema = z.object({
  durationMs: z.number().int().nonnegative(),
  endedAt: timestampSchema,
  error: z.string().min(1).nullable(),
  exitCode: z.number().int().nullable(),
  exportedEnvironmentKeys: z.array(z.string()),
  id: z.enum([
    "flow-cleanup",
    "flow-prepare",
    "project-cleanup",
    "project-prepare",
  ]),
  phase: z.enum(["cleanup", "prepare"]),
  result: portablePathSchema,
  scope: z.enum(["flow", "project"]),
  startedAt: timestampSchema,
  status: z.enum(["failed", "passed"]),
  stderr: portablePathSchema,
  stdout: portablePathSchema,
  timedOut: z.boolean(),
});

const failureSchema = z.object({
  failedCommand: z.string().min(1).nullable(),
  failedSelector: z.string().min(1).nullable(),
  message: z.string().min(1).nullable(),
  summary: z.string().min(1).nullable(),
});

export const normalizedEvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  run: z.object({
    completedAt: timestampSchema,
    createdAt: timestampSchema,
    durationMs: z.number().int().nonnegative(),
    exitCode: z.number().int(),
    mobtraceVersion: z.string().min(1),
    outcome: primaryOutcomeSchema,
    runId: runIdSchema,
    status: overallStatusSchema,
  }),
  flow: z.object({
    name: z.string().min(1).nullable(),
    path: portablePathSchema,
    resolution: flowResolutionSchema,
    runner: z.literal("maestro"),
  }),
  device: z.object({
    available: z.boolean().nullable(),
    id: z.string().min(1).nullable(),
    platform: z.enum(["android", "ios", "unknown"]),
  }),
  source: sourceSchema,
  journey: journeySchema,
  phases: z.array(phaseResultSchema),
  hooks: z.array(hookSchema),
  failure: failureSchema,
});

export type NormalizedEvidence = z.infer<typeof normalizedEvidenceSchema>;

export interface NormalizeEvidenceResult {
  readonly evidence: NormalizedEvidence;
  readonly path: string;
}

export async function normalizeLifecycleEvidence(
  artifactStore: ArtifactStore,
  lifecycle: VerifyLifecycleResult,
): Promise<NormalizeEvidenceResult> {
  const manifest = await artifactStore.readManifest(lifecycle.runId);
  if (manifest.completedAt === null) {
    throw new Error("Cannot normalize a run before lifecycle completion.");
  }

  const evidence = normalizedEvidenceSchema.parse({
    schemaVersion: 1,
    run: {
      completedAt: manifest.completedAt,
      createdAt: manifest.createdAt,
      durationMs: Math.max(
        0,
        new Date(manifest.completedAt).getTime() -
          new Date(manifest.createdAt).getTime(),
      ),
      exitCode: lifecycle.exitCode,
      mobtraceVersion: manifest.mobtraceVersion,
      outcome: lifecycle.outcome,
      runId: lifecycle.runId,
      status: lifecycle.status,
    },
    flow: {
      name: lifecycle.flow.flowName,
      path: lifecycle.flow.flowPathRelative,
      resolution: lifecycle.flow.resolution,
      runner: "maestro",
    },
    device: {
      available: null,
      id: lifecycle.flow.device ?? null,
      platform: "unknown",
    },
    source: normalizeSource(lifecycle),
    journey: lifecycle.journey,
    phases: lifecycle.phases,
    hooks: lifecycle.hooks.map((hook) => ({
      durationMs: hook.durationMs,
      endedAt: hook.endedAt,
      error: hook.error,
      exitCode: hook.exitCode,
      exportedEnvironmentKeys: hook.exportedEnvironmentKeys,
      id: hook.id,
      phase: hook.phase,
      result: hook.result,
      scope: hook.scope,
      startedAt: hook.startedAt,
      status: hook.status,
      stderr: hook.stderr,
      stdout: hook.stdout,
      timedOut: hook.timedOut,
    })),
    failure: await extractFailureFacts(artifactStore, lifecycle),
  });

  return {
    evidence,
    path: await artifactStore.writeJson(
      lifecycle.runId,
      "evidence/normalized.json",
      evidence,
    ),
  };
}

function normalizeSource(
  lifecycle: VerifyLifecycleResult,
): NormalizedEvidence["source"] {
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
