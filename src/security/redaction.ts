import * as z from "zod";

import type { ResolvedEnvironmentEntry } from "../configuration/resolve.js";
import type { MobtraceConfig } from "../configuration/schema.js";
import { Redactor, type RedactionPattern } from "../process/redaction.js";

const patternSchema = z.object({
  flags: z.string(),
  name: z.string().min(1),
  regex: z.string().min(1),
});

export const generatedRedactionPolicySchema = z.object({
  environmentNames: z.array(z.string()),
  patterns: z.array(patternSchema),
  schemaVersion: z.literal(1),
});

export type GeneratedRedactionPolicy = z.infer<
  typeof generatedRedactionPolicySchema
>;

const builtInPatterns: GeneratedRedactionPolicy["patterns"] = [
  {
    flags: "giu",
    name: "authorization-bearer",
    regex: String.raw`\bbearer\s+[a-z0-9._~+/-]+=*`,
  },
  {
    flags: "giu",
    name: "credential-assignment",
    regex: String.raw`\b(?:api[_-]?key|password|secret|token)\s*[:=]\s*["']?[^\s"',;]+`,
  },
];

export function createGeneratedRedactionPolicy(
  config: MobtraceConfig | null,
): GeneratedRedactionPolicy {
  return generatedRedactionPolicySchema.parse({
    environmentNames: [...(config?.diagnosis?.redact?.environment ?? [])],
    patterns: [
      ...builtInPatterns,
      ...(config?.diagnosis?.redact?.patterns ?? []).map((pattern) => ({
        flags: pattern.flags ?? "",
        name: pattern.name,
        regex: pattern.regex,
      })),
    ],
    schemaVersion: 1,
  });
}

export function createRunRedactor(
  policy: GeneratedRedactionPolicy,
  environment: ReadonlyMap<string, ResolvedEnvironmentEntry>,
  processEnv: NodeJS.ProcessEnv = process.env,
): Redactor {
  const values = [
    ...[...environment.values()]
      .filter((entry) => entry.sensitive)
      .map((entry) => entry.value),
    ...policy.environmentNames.flatMap((name) => {
      const value = processEnv[name];
      return value === undefined ? [] : [value];
    }),
  ];

  return createPolicyRedactor(policy, values);
}

export function createPolicyRedactor(
  policy: GeneratedRedactionPolicy,
  values: readonly string[] = [],
): Redactor {
  return new Redactor({
    patterns: policy.patterns.map(toPattern),
    values,
  });
}

export function redactStructured<T>(value: T, redactor: Redactor): T {
  if (typeof value === "string") {
    return redactor.redact(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactStructured(entry, redactor)) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        redactStructured(entry, redactor),
      ]),
    ) as T;
  }
  return value;
}

function toPattern(
  pattern: GeneratedRedactionPolicy["patterns"][number],
): RedactionPattern {
  return {
    name: pattern.name,
    regex: new RegExp(pattern.regex, pattern.flags),
  };
}
