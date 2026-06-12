import { randomBytes } from "node:crypto";

import { runIdSchema } from "../contracts/report.js";
import { ArtifactStoreError } from "./errors.js";

export type RandomBytes = (size: number) => Uint8Array;

function compactUtcTimestamp(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new ArtifactStoreError("invalid-run-id", "Run date is invalid.");
  }
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function createRunId(
  date = new Date(),
  createRandomBytes: RandomBytes = randomBytes,
): string {
  const suffix = Buffer.from(createRandomBytes(3)).toString("hex");
  const runId = `${compactUtcTimestamp(date)}-${suffix}`;
  const result = runIdSchema.safeParse(runId);
  if (!result.success) {
    throw new ArtifactStoreError(
      "invalid-run-id",
      "Generated run ID does not satisfy the v0.1 contract.",
      { cause: result.error },
    );
  }
  return result.data;
}

export function assertRunId(value: string): string {
  const result = runIdSchema.safeParse(value);
  if (!result.success) {
    throw new ArtifactStoreError("invalid-run-id", `Invalid run ID: ${value}`, {
      cause: result.error,
    });
  }
  return result.data;
}
