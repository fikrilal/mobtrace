import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { ArtifactStoreError } from "../src/artifacts/errors.js";
import {
  assertPortablePath,
  resolveArtifactRoot,
  resolveRunArtifactPath,
  toRunRelativePath,
} from "../src/artifacts/paths.js";

describe("artifact paths", () => {
  it("resolves the default artifact root from the project", () => {
    expect(resolveArtifactRoot("/work/app")).toBe(
      resolve("/work/app/.mobtrace/runs"),
    );
  });

  it("normalizes a nested file to a POSIX run-relative path", () => {
    const run = resolve("/tmp/run");
    const target = resolve(run, "runner", "result.json");

    expect(toRunRelativePath(run, target)).toBe("runner/result.json");
  });

  it.each([
    "../secret",
    "/tmp/secret",
    "runner\\result.json",
  ])("rejects unsafe portable path %s", (path) => {
    expect(() => assertPortablePath(path)).toThrowError(
      expect.objectContaining<Partial<ArtifactStoreError>>({
        code: "invalid-path",
      }),
    );
  });

  it("resolves only files below the run directory", () => {
    expect(resolveRunArtifactPath("/tmp/run", "source/diff.patch")).toBe(
      resolve("/tmp/run/source/diff.patch"),
    );
    expect(() => toRunRelativePath("/tmp/run", "/tmp/outside")).toThrowError(
      expect.objectContaining<Partial<ArtifactStoreError>>({
        code: "invalid-path",
      }),
    );
  });
});
