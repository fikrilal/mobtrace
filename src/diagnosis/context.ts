import { readFile } from "node:fs/promises";

import * as z from "zod";

import type { ArtifactStore } from "../artifacts/store.js";
import { resolveProjectPath } from "../configuration/load.js";
import type { MobtraceConfig } from "../configuration/schema.js";
import {
  failureClassSchema,
  failureDomainSchema,
} from "../contracts/report.js";
import {
  createGeneratedRedactionPolicy,
  generatedRedactionPolicySchema,
} from "../security/redaction.js";

const flagsSchema = z
  .string()
  .regex(/^[imsu]*$/)
  .refine((value) => new Set(value).size === value.length);

const signatureMatchSchema = z
  .object({
    changedPath: z.string().min(1).optional(),
    failedCommand: z.string().min(1).optional(),
    failedSelector: z.string().min(1).optional(),
    failureClass: failureClassSchema.optional(),
    failureDomain: failureDomainSchema.optional(),
    message: z.string().min(1).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Signature match must define at least one condition.",
  });

export const diagnosisSignatureSchema = z
  .object({
    action: z.string().min(1),
    flags: flagsSchema.optional(),
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    match: signatureMatchSchema,
  })
  .strict()
  .superRefine((signature, context) => {
    for (const [key, value] of Object.entries(signature.match)) {
      if (
        key === "failureClass" ||
        key === "failureDomain" ||
        value === undefined
      ) {
        continue;
      }
      try {
        new RegExp(value, signature.flags);
      } catch (error) {
        context.addIssue({
          code: "custom",
          message:
            error instanceof Error
              ? `Invalid ${key} regular expression: ${error.message}`
              : `Invalid ${key} regular expression.`,
          path: ["match", key],
        });
      }
    }
  });

const signatureFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    signatures: z.array(diagnosisSignatureSchema),
  })
  .strict();

export const diagnosisContextSchema = z.object({
  schemaVersion: z.literal(1),
  ruleSetVersion: z.literal(1),
  ownership: z.array(z.string().min(1)),
  redaction: generatedRedactionPolicySchema,
  signatures: z.array(diagnosisSignatureSchema),
});

export type DiagnosisContext = z.infer<typeof diagnosisContextSchema>;
export type DiagnosisSignature = z.infer<typeof diagnosisSignatureSchema>;

export async function createDiagnosisContext(
  projectRoot: string,
  config: MobtraceConfig | null,
  ownership: readonly string[],
): Promise<DiagnosisContext> {
  const signatures: DiagnosisSignature[] = [];
  const identifiers = new Set<string>();

  for (const configuredPath of config?.diagnosis?.signatures ?? []) {
    const path = resolveProjectPath(projectRoot, configuredPath);
    const file = signatureFileSchema.parse(
      JSON.parse(await readFile(path, "utf8")),
    );
    for (const signature of file.signatures) {
      if (identifiers.has(signature.id)) {
        throw new Error(`Duplicate diagnosis signature ID: ${signature.id}`);
      }
      identifiers.add(signature.id);
      signatures.push(signature);
    }
  }

  return diagnosisContextSchema.parse({
    ownership: [...ownership],
    redaction: createGeneratedRedactionPolicy(config),
    ruleSetVersion: 1,
    schemaVersion: 1,
    signatures,
  });
}

export async function writeDiagnosisContext(
  artifactStore: ArtifactStore,
  runId: string,
  context: DiagnosisContext,
): Promise<string> {
  return artifactStore.writeJson(
    runId,
    "evidence/diagnosis-context.json",
    context,
  );
}
