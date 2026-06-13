import { describe, expect, it } from "vitest";

import {
  type PackedFile,
  validatePackedFiles,
} from "../scripts/package-smoke.ts";

const validFiles: readonly PackedFile[] = [
  { mode: 0o644, path: "CHANGELOG.md" },
  { mode: 0o644, path: "README.md" },
  { mode: 0o644, path: "dist/cli.d.ts" },
  { mode: 0o755, path: "dist/cli.js" },
  { mode: 0o644, path: "dist/cli.js.map" },
  { mode: 0o644, path: "docs/README.md" },
  { mode: 0o644, path: "docs/contracts/cli.md" },
  { mode: 0o644, path: "docs/contracts/configuration.md" },
  { mode: 0o644, path: "docs/contracts/report.md" },
  {
    mode: 0o644,
    path: "docs/engineering/mobile-core-kit-integration.md",
  },
  { mode: 0o644, path: "docs/engineering/platform-support.md" },
  { mode: 0o644, path: "docs/engineering/product-validation.md" },
  { mode: 0o644, path: "docs/engineering/release-checklist.md" },
  { mode: 0o644, path: "docs/product/product.md" },
  { mode: 0o644, path: "examples/minimal/mobtrace.yaml" },
  { mode: 0o644, path: "package.json" },
];

describe("package-content verification", () => {
  it("accepts the intended package shape", () => {
    expect(
      validatePackedFiles(
        {
          bin: { mobtrace: "./dist/cli.js" },
          name: "mobtrace",
          version: "0.1.0",
        },
        validFiles,
      ),
    ).toEqual([]);
  });

  it("rejects a missing executable", () => {
    const files = validFiles.filter((file) => file.path !== "dist/cli.js");

    expect(
      validatePackedFiles(
        {
          bin: { mobtrace: "./dist/cli.js" },
          name: "mobtrace",
          version: "0.1.0",
        },
        files,
      ),
    ).toContain("Packaged CLI entry is missing: dist/cli.js");
  });

  it("rejects unexpected package contents", () => {
    expect(
      validatePackedFiles(
        {
          bin: { mobtrace: "./dist/cli.js" },
          name: "mobtrace",
          version: "0.1.0",
        },
        [...validFiles, { mode: 0o644, path: "src/cli.ts" }],
      ),
    ).toContain("Package contains unexpected file: src/cli.ts");
  });
});
