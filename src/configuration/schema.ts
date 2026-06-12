import { z } from "zod";

import { durationStringSchema } from "./duration.js";

const nonEmptyStringSchema = z.string().min(1);
const pathStringSchema = nonEmptyStringSchema;
const environmentNameSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
  .refine((value) => !value.startsWith("MOBTRACE_"), {
    message: "MOBTRACE_ environment keys are reserved.",
  });
const flowNameSchema = z
  .string()
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/);
const diagnosisNameSchema = z.string().regex(/^[a-z0-9-]+$/);

const environmentValueSchema = z.union([
  z
    .object({
      value: z.string(),
    })
    .strict(),
  z
    .object({
      fromEnv: environmentNameSchema,
    })
    .strict(),
]);

const environmentSchema = z.record(
  environmentNameSchema,
  environmentValueSchema,
);

const hookSchema = z
  .object({
    command: z.array(z.string()).min(1),
    timeout: durationStringSchema.optional(),
  })
  .strict();

const hooksSchema = z
  .object({
    cleanup: hookSchema.optional(),
    prepare: hookSchema.optional(),
  })
  .strict();

const flowSchema = z
  .object({
    baseline: nonEmptyStringSchema.optional(),
    device: nonEmptyStringSchema.optional(),
    environment: environmentSchema.optional(),
    hooks: hooksSchema.optional(),
    owns: z.array(pathStringSchema).optional(),
    path: pathStringSchema,
    timeout: durationStringSchema.optional(),
  })
  .strict();

const flagsSchema = z
  .string()
  .regex(/^[imsu]*$/)
  .refine((value) => new Set(value).size === value.length, {
    message: "Regular expression flags must not be duplicated.",
  });

const diagnosisPatternSchema = z
  .object({
    flags: flagsSchema.optional(),
    name: diagnosisNameSchema,
    regex: z.string().min(1),
  })
  .strict()
  .superRefine((value, context) => {
    try {
      new RegExp(value.regex, value.flags);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof Error
            ? `Invalid regular expression: ${error.message}`
            : "Invalid regular expression.",
        path: ["regex"],
      });
    }
  });

const diagnosisSchema = z
  .object({
    redact: z
      .object({
        environment: z.array(environmentNameSchema).optional(),
        patterns: z.array(diagnosisPatternSchema).optional(),
      })
      .strict()
      .optional(),
    signatures: z.array(pathStringSchema).optional(),
  })
  .strict();

export const mobtraceConfigSchema = z
  .object({
    artifacts: z
      .object({
        root: pathStringSchema.optional(),
      })
      .strict()
      .optional(),
    defaults: z
      .object({
        baseline: nonEmptyStringSchema.optional(),
        device: nonEmptyStringSchema.optional(),
        timeout: durationStringSchema.optional(),
      })
      .strict()
      .optional(),
    diagnosis: diagnosisSchema.optional(),
    environment: environmentSchema.optional(),
    flows: z.record(flowNameSchema, flowSchema).optional(),
    hooks: hooksSchema.optional(),
    maestro: z
      .object({
        executable: nonEmptyStringSchema.optional(),
      })
      .strict()
      .optional(),
    version: z.literal(1),
  })
  .strict();

export type MobtraceConfig = z.infer<typeof mobtraceConfigSchema>;
export type ConfiguredEnvironment = z.infer<typeof environmentSchema>;
export type ConfiguredFlow = z.infer<typeof flowSchema>;
export type ConfiguredHook = z.infer<typeof hookSchema>;
export type ConfiguredHooks = z.infer<typeof hooksSchema>;
