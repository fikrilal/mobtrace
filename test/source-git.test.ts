import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ArtifactStore } from "../src/artifacts/store.js";
import { executeProcess } from "../src/process/execute.js";
import { captureGitSourceEvidence } from "../src/source/git.js";

const temporaryDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mobtrace-source-"));
  temporaryDirectories.push(root);
  return root;
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  const result = await executeProcess({ args, cwd, executable: "git" });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr);
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await rm(path, { force: true, recursive: true });
    }),
  );
});

describe("Git source evidence", () => {
  it("returns unavailable outside a Git worktree", async () => {
    const root = await createTempDir();
    const store = new ArtifactStore(join(root, ".mobtrace/runs"));
    await store.initializeRun({
      flowPath: ".maestro/login.yaml",
      flowResolution: "path",
      runId: "20260612T000000Z-a00001",
    });

    const result = await captureGitSourceEvidence({
      artifactStore: store,
      baseline: "HEAD",
      projectRoot: root,
      runId: "20260612T000000Z-a00001",
    });

    expect(result).toEqual({
      available: false,
      reason: "not-a-git-worktree",
    });
  });

  it("captures committed, staged, unstaged, and untracked changes", async () => {
    const root = await createTempDir();
    await git(root, ["init"]);
    await git(root, ["config", "user.email", "test@example.test"]);
    await git(root, ["config", "user.name", "MobTrace Test"]);
    await writeFile(join(root, "tracked.txt"), "base\n", "utf8");
    await git(root, ["add", "tracked.txt"]);
    await git(root, ["commit", "-m", "base"]);
    const baseline = (
      await executeProcess({
        args: ["rev-parse", "HEAD"],
        cwd: root,
        executable: "git",
      })
    ).stdout.trim();

    await writeFile(join(root, "committed.txt"), "committed\n", "utf8");
    await git(root, ["add", "committed.txt"]);
    await git(root, ["commit", "-m", "committed"]);
    await writeFile(join(root, "staged.txt"), "staged\n", "utf8");
    await git(root, ["add", "staged.txt"]);
    await writeFile(join(root, "tracked.txt"), "base\nunstaged\n", "utf8");
    await writeFile(join(root, "untracked.txt"), "untracked\n", "utf8");

    const store = new ArtifactStore(join(root, ".mobtrace/runs"));
    await store.initializeRun({
      flowPath: ".maestro/login.yaml",
      flowResolution: "path",
      runId: "20260612T000000Z-a00002",
    });

    const result = await captureGitSourceEvidence({
      artifactStore: store,
      baseline,
      projectRoot: root,
      runId: "20260612T000000Z-a00002",
    });

    expect(result.available).toBe(true);
    if (!result.available) {
      return;
    }

    const changedFiles = JSON.parse(
      await readFile(
        join(
          root,
          ".mobtrace/runs/20260612T000000Z-a00002",
          result.changedFiles,
        ),
        "utf8",
      ),
    ) as Array<{
      path: string;
      staged: boolean;
      status: string;
      unstaged: boolean;
    }>;
    const diff = await readFile(
      join(root, ".mobtrace/runs/20260612T000000Z-a00002", result.diff),
      "utf8",
    );

    expect(result.baselineCommit).toBe(baseline);
    expect(result.dirty).toBe(true);
    expect(changedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "committed.txt", status: "added" }),
        expect.objectContaining({ path: "staged.txt", staged: true }),
        expect.objectContaining({ path: "tracked.txt", unstaged: true }),
        expect.objectContaining({ path: "untracked.txt", status: "untracked" }),
      ]),
    );
    expect(diff).toContain("# mobtrace-diff-section: baseline-to-head");
    expect(diff).toContain("# mobtrace-diff-section: staged");
    expect(diff).toContain("# mobtrace-diff-section: unstaged");
    expect(diff).toContain("# mobtrace-diff-section: untracked");
    expect(diff).toContain("untracked.txt");
  });
});
