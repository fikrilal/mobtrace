import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createDiagnosisContext,
  type DiagnosisContext,
} from "../src/diagnosis/context.js";
import { rankSuspiciousChanges } from "../src/diagnosis/rank.js";
import { matchSignatures } from "../src/diagnosis/signatures.js";
import {
  type NormalizedEvidence,
  normalizedEvidenceSchema,
} from "../src/evidence/normalized.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await rm(path, { force: true, recursive: true });
    }),
  );
});

describe("diagnosis correlation", () => {
  it("biases ranking toward declared flow ownership", () => {
    const result = rankSuspiciousChanges({
      changedFiles: [
        {
          path: "lib/unrelated/a.dart",
          staged: false,
          status: "modified",
          unstaged: true,
        },
        {
          path: "lib/features/auth/login_controller.dart",
          staged: false,
          status: "modified",
          unstaged: true,
        },
      ],
      diff: "",
      failedSelector: null,
      failureClass: "unknown",
      ownership: ["lib/features/auth/"],
    });

    expect(result[0]).toMatchObject({
      path: "lib/features/auth/login_controller.dart",
      reasons: expect.arrayContaining([
        expect.objectContaining({ code: "flow-ownership" }),
      ]),
    });
  });

  it.each([
    {
      expected: "assertion-false-missing-id",
      failureClass: "selector-mismatch" as const,
      message: "Element not found: home_screen",
    },
    {
      expected: "backend-unauthorized-after-login-submit",
      failureClass: "backend-http-error" as const,
      message: "HTTP 401 unauthorized after login",
    },
    {
      expected: "fixture-cleanup-empty-json-body",
      failureClass: "fixture-cleanup-failed" as const,
      message: "Unexpected end of JSON from empty cleanup response",
    },
  ])("matches historical signature $expected", ({
    expected,
    failureClass,
    message,
  }) => {
    const evidence = failureEvidence(message);

    const matches = matchSignatures({
      context: emptyContext,
      evidence,
      failureClass,
      failureDomain: domainFor(failureClass),
      suspiciousChanges: [],
    });

    expect(matches).toContainEqual(
      expect.objectContaining({
        id: expected,
        action: expect.any(String),
      }),
    );
  });

  it("loads project signatures in declared file order", async () => {
    const root = await mkdtemp(join(tmpdir(), "mobtrace-signatures-"));
    temporaryDirectories.push(root);
    await writeFile(
      join(root, "signatures.json"),
      JSON.stringify({
        schemaVersion: 1,
        signatures: [
          {
            id: "project-login-contract",
            action: "Inspect the project login contract.",
            match: {
              failureClass: "backend-http-error",
              changedPath: "auth_repository",
            },
          },
        ],
      }),
      "utf8",
    );

    const context = await createDiagnosisContext(
      root,
      {
        version: 1,
        diagnosis: { signatures: ["signatures.json"] },
      },
      ["lib/features/auth/"],
    );
    const matches = matchSignatures({
      context,
      evidence: failureEvidence("HTTP 500"),
      failureClass: "backend-http-error",
      failureDomain: "backend",
      suspiciousChanges: [
        {
          path: "lib/features/auth/data/auth_repository.dart",
          rank: 1,
          reasons: [
            {
              code: "changed-api-contract",
              evidence: ["source-diff"],
              message: "API changed.",
            },
          ],
        },
      ],
    });

    expect(matches.at(-1)).toMatchObject({
      id: "project-login-contract",
      action: "Inspect the project login contract.",
    });
    expect(context.ownership).toEqual(["lib/features/auth/"]);
  });

  it("rejects duplicate project signature identifiers", async () => {
    const root = await mkdtemp(join(tmpdir(), "mobtrace-signatures-"));
    temporaryDirectories.push(root);
    const file = {
      schemaVersion: 1,
      signatures: [
        {
          id: "duplicate",
          action: "Inspect it.",
          match: { message: "failed" },
        },
      ],
    };
    await writeFile(join(root, "one.json"), JSON.stringify(file), "utf8");
    await writeFile(join(root, "two.json"), JSON.stringify(file), "utf8");

    await expect(
      createDiagnosisContext(
        root,
        {
          version: 1,
          diagnosis: { signatures: ["one.json", "two.json"] },
        },
        [],
      ),
    ).rejects.toThrow("Duplicate diagnosis signature ID");
  });
});

const emptyContext: DiagnosisContext = {
  ownership: [],
  redaction: { environmentNames: [], patterns: [], schemaVersion: 1 },
  ruleSetVersion: 1,
  schemaVersion: 1,
  signatures: [],
};

function failureEvidence(message: string): NormalizedEvidence {
  return normalizedEvidenceSchema.parse({
    schemaVersion: 1,
    run: {
      completedAt: "2026-06-12T10:00:02.000Z",
      createdAt: "2026-06-12T10:00:00.000Z",
      durationMs: 2000,
      exitCode: 1,
      mobtraceVersion: "0.0.0",
      outcome: "journey-failed",
      runId: "20260612T100000Z-f00002",
      status: "failed",
    },
    flow: {
      name: "login",
      path: ".maestro/login.yaml",
      resolution: "configured",
      runner: "maestro",
    },
    device: { available: null, id: null, platform: "unknown" },
    source: { available: false, reason: "not-a-git-worktree" },
    journey: {
      command: { arguments: ["test", "<flow>"], executable: "maestro" },
      durationMs: 1,
      endedAt: "2026-06-12T10:00:02.000Z",
      error: { code: "runner-error", message },
      exitCode: 1,
      result: "runner/result.json",
      startedAt: "2026-06-12T10:00:01.999Z",
      status: "failed",
      stderr: "runner/stderr.log",
      stdout: "runner/stdout.log",
      timedOut: false,
    },
    phases: [],
    hooks: [],
    failure: {
      failedCommand: "test <flow>",
      failedSelector: message.includes("home_screen") ? "home_screen" : null,
      message,
      summary: "The mobile journey failed.",
    },
  });
}

function domainFor(
  failureClass:
    | "backend-http-error"
    | "fixture-cleanup-failed"
    | "selector-mismatch",
): "backend" | "test-harness" {
  return failureClass === "selector-mismatch" ? "test-harness" : "backend";
}
