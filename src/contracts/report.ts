import * as z from "zod";

const rfc3339UtcSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

export const runIdSchema = z.string().regex(/^\d{8}T\d{6}Z-[0-9a-f]{6}$/);

export const portablePathSchema = z.string().check(
  z.refine(
    (value) => {
      if (value.length === 0 || value.includes("\\") || value.includes("\0")) {
        return false;
      }
      if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) {
        return false;
      }
      return value
        .split("/")
        .every(
          (segment) =>
            segment.length > 0 && segment !== "." && segment !== "..",
        );
    },
    { error: "Expected a portable run-relative path" },
  ),
);

export const phaseIdSchema = z.enum([
  "validation",
  "source",
  "prepare-project",
  "prepare-flow",
  "journey",
  "cleanup-flow",
  "cleanup-project",
  "normalize",
  "report",
]);

export const phaseStatusSchema = z.enum([
  "pending",
  "running",
  "passed",
  "failed",
  "skipped",
  "interrupted",
]);

export const phaseErrorSchema = z.object({
  code: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  message: z.string().min(1),
});

export const phaseResultSchema = z.object({
  id: phaseIdSchema,
  status: phaseStatusSchema,
  startedAt: rfc3339UtcSchema.nullable(),
  endedAt: rfc3339UtcSchema.nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  exitCode: z.number().int().nullable(),
  timedOut: z.boolean(),
  error: phaseErrorSchema.nullable(),
  evidence: z.array(z.string().min(1)),
});

export const manifestStateSchema = z.enum(["running", "completed", "partial"]);

export const flowResolutionSchema = z.enum(["configured", "path"]);

export const runManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: runIdSchema,
    state: manifestStateSchema,
    createdAt: rfc3339UtcSchema,
    updatedAt: rfc3339UtcSchema,
    completedAt: rfc3339UtcSchema.nullable(),
    mobtraceVersion: z.string().min(1),
    project: z.object({
      sourceControl: z.literal("git").nullable(),
    }),
    flow: z.object({
      name: z.string().min(1).nullable(),
      path: portablePathSchema,
      resolution: flowResolutionSchema,
    }),
    device: z.object({
      id: z.string().min(1).nullable(),
    }),
    phases: z.array(phaseResultSchema),
  })
  .superRefine((manifest, context) => {
    const terminal = manifest.state !== "running";
    if (terminal === (manifest.completedAt === null)) {
      context.addIssue({
        code: "custom",
        message:
          "Running manifests require completedAt=null; terminal manifests require a timestamp",
        path: ["completedAt"],
      });
    }
  });

export const overallStatusSchema = z.enum([
  "passed",
  "failed",
  "error",
  "interrupted",
]);

export const primaryOutcomeSchema = z.enum([
  "verified-pass",
  "journey-failed",
  "invalid-invocation",
  "preparation-failed",
  "infrastructure-failed",
  "cleanup-failed",
  "processing-failed",
  "interrupted",
]);

const flowResultSchema = z.object({
  name: z.string().min(1).nullable(),
  path: portablePathSchema,
  resolution: flowResolutionSchema,
  runner: z.literal("maestro"),
});

const deviceResultSchema = z.object({
  id: z.string().min(1).nullable(),
  platform: z.enum(["android", "ios", "unknown"]),
  available: z.boolean().nullable(),
});

const availableSourceResultSchema = z.object({
  available: z.literal(true),
  branch: z.string().min(1).nullable(),
  head: z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/),
  baseline: z.string().min(1),
  baselineCommit: z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/),
  dirty: z.boolean(),
  changedFileCount: z.number().int().nonnegative(),
  untrackedFileCount: z.number().int().nonnegative(),
  metadata: portablePathSchema,
  changedFiles: portablePathSchema,
  diff: portablePathSchema,
});

const unavailableSourceResultSchema = z.object({
  available: z.literal(false),
  reason: z.string().min(1),
});

const journeyResultSchema = z.object({
  status: z.enum(["passed", "failed", "not-run", "interrupted"]),
  startedAt: rfc3339UtcSchema.nullable(),
  endedAt: rfc3339UtcSchema.nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  exitCode: z.number().int().nullable(),
  timedOut: z.boolean(),
  command: z
    .object({
      executable: z.string().min(1),
      arguments: z.array(z.string()),
    })
    .nullable(),
  result: portablePathSchema.nullable(),
  stdout: portablePathSchema.nullable(),
  stderr: portablePathSchema.nullable(),
});

const failureFactsSchema = z.object({
  summary: z.string().min(1).nullable(),
  failedCommand: z.string().min(1).nullable(),
  failedSelector: z.string().min(1).nullable(),
  message: z.string().min(1).nullable(),
});

export const failureClassSchema = z.enum([
  "none",
  "device-not-ready",
  "runner-unavailable",
  "runner-error",
  "runner-timeout",
  "selector-mismatch",
  "input-not-applied",
  "app-did-not-navigate",
  "backend-http-error",
  "fixture-setup-failed",
  "fixture-cleanup-failed",
  "processing-error",
  "unknown",
]);

export const failureDomainSchema = z.enum([
  "none",
  "application",
  "test-harness",
  "backend",
  "infrastructure",
  "unknown",
]);

const matchedSignatureSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  evidence: z.array(z.string().min(1)),
});

const suspiciousReasonSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  evidence: z.array(z.string().min(1)),
});

const suspiciousChangeSchema = z.object({
  rank: z.number().int().positive(),
  path: portablePathSchema,
  reasons: z.array(suspiciousReasonSchema).min(1),
});

const diagnosisResultSchema = z.object({
  failureClass: failureClassSchema,
  failureDomain: failureDomainSchema,
  matchedSignatures: z.array(matchedSignatureSchema),
  suspiciousChanges: z.array(suspiciousChangeSchema).max(10),
  suggestedAction: z.string().min(1),
});

export const evidenceTypeSchema = z.enum([
  "run-manifest",
  "source-metadata",
  "source-changed-files",
  "source-diff",
  "hook-result",
  "hook-log",
  "runner-result",
  "runner-log",
  "junit",
  "screenshot",
  "view-hierarchy",
  "device-log",
  "normalized-evidence",
  "human-report",
  "machine-report",
  "mobtrace-log",
  "other",
]);

const evidenceReferenceSchema = z.object({
  id: z.string().min(1),
  type: evidenceTypeSchema,
  path: portablePathSchema,
  mediaType: z.string().min(1),
  description: z.string().min(1),
  redacted: z.boolean(),
  sensitive: z.boolean(),
});

const reportsResultSchema = z.object({
  markdown: portablePathSchema,
  json: portablePathSchema,
});

export const finalResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: runIdSchema,
    mobtraceVersion: z.string().min(1),
    createdAt: rfc3339UtcSchema,
    completedAt: rfc3339UtcSchema,
    durationMs: z.number().int().nonnegative(),
    generatedAt: rfc3339UtcSchema,
    generatedByVersion: z.string().min(1),
    sourceRunCompletedAt: rfc3339UtcSchema,
    status: overallStatusSchema,
    outcome: primaryOutcomeSchema,
    exitCode: z.number().int(),
    flow: flowResultSchema,
    device: deviceResultSchema,
    source: z.discriminatedUnion("available", [
      availableSourceResultSchema,
      unavailableSourceResultSchema,
    ]),
    journey: journeyResultSchema,
    phases: z.array(phaseResultSchema),
    failure: failureFactsSchema,
    diagnosis: diagnosisResultSchema,
    evidence: z.array(evidenceReferenceSchema),
    reports: reportsResultSchema,
  })
  .superRefine((result, context) => {
    result.diagnosis.suspiciousChanges.forEach((change, index) => {
      if (change.rank !== index + 1) {
        context.addIssue({
          code: "custom",
          message: "Suspicious change ranks must be contiguous and begin at 1",
          path: ["diagnosis", "suspiciousChanges", index, "rank"],
        });
      }
    });

    const evidenceIds = new Set<string>();
    result.evidence.forEach((evidence, index) => {
      if (evidenceIds.has(evidence.id)) {
        context.addIssue({
          code: "custom",
          message: "Evidence IDs must be unique within a run",
          path: ["evidence", index, "id"],
        });
      }
      evidenceIds.add(evidence.id);
    });
  });

export type PhaseId = z.infer<typeof phaseIdSchema>;
export type PhaseStatus = z.infer<typeof phaseStatusSchema>;
export type PhaseError = z.infer<typeof phaseErrorSchema>;
export type PhaseResult = z.infer<typeof phaseResultSchema>;
export type ManifestState = z.infer<typeof manifestStateSchema>;
export type FlowResolution = z.infer<typeof flowResolutionSchema>;
export type RunManifest = z.infer<typeof runManifestSchema>;
export type OverallStatus = z.infer<typeof overallStatusSchema>;
export type PrimaryOutcome = z.infer<typeof primaryOutcomeSchema>;
export type FailureClass = z.infer<typeof failureClassSchema>;
export type FailureDomain = z.infer<typeof failureDomainSchema>;
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;
export type FinalResult = z.infer<typeof finalResultSchema>;
