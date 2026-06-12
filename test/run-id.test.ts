import { describe, expect, it } from "vitest";

import type { ArtifactStoreError } from "../src/artifacts/errors.js";
import { assertRunId, createRunId } from "../src/artifacts/run-id.js";

describe("run IDs", () => {
  it("uses the contracted UTC timestamp and hexadecimal suffix", () => {
    expect(
      createRunId(new Date("2026-06-12T01:02:03.456Z"), () =>
        Uint8Array.from([0x0a, 0x1b, 0xff]),
      ),
    ).toBe("20260612T010203Z-0a1bff");
  });

  it("rejects malformed IDs with a typed error", () => {
    expect(() => assertRunId("latest")).toThrowError(
      expect.objectContaining<Partial<ArtifactStoreError>>({
        code: "invalid-run-id",
      }),
    );
  });
});
