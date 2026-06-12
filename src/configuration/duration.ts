import { z } from "zod";

const durationPattern = /^([1-9][0-9]*)(ms|s|m|h)$/;

const unitToMilliseconds = {
  h: 60 * 60 * 1000,
  m: 60 * 1000,
  ms: 1,
  s: 1000,
} as const;

export const durationStringSchema = z
  .string()
  .regex(durationPattern, "Expected a positive duration such as 500ms or 15m.");

export interface ResolvedDuration {
  readonly milliseconds: number;
  readonly value: string;
}

export function parseDuration(value: string): ResolvedDuration {
  const match = durationPattern.exec(value);
  if (match === null) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number.parseInt(match[1] ?? "", 10);
  const unit = match[2] as keyof typeof unitToMilliseconds;

  return {
    milliseconds: amount * unitToMilliseconds[unit],
    value,
  };
}
