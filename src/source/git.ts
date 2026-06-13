import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";

import type { ArtifactStore } from "../artifacts/store.js";
import { executeProcess } from "../process/execute.js";

export type SourceFileStatus =
  | "added"
  | "copied"
  | "deleted"
  | "modified"
  | "renamed"
  | "type-changed"
  | "unknown"
  | "untracked";

export interface ChangedFile {
  readonly path: string;
  readonly previousPath?: string;
  readonly staged: boolean;
  readonly status: SourceFileStatus;
  readonly unstaged: boolean;
}

export interface AvailableSourceEvidence {
  readonly available: true;
  readonly baseline: string;
  readonly baselineCommit: string;
  readonly branch: string | null;
  readonly changedFileCount: number;
  readonly changedFiles: string;
  readonly diff: string;
  readonly dirty: boolean;
  readonly head: string;
  readonly metadata: string;
  readonly repositoryRoot: string;
  readonly untrackedFileCount: number;
}

export interface UnavailableSourceEvidence {
  readonly available: false;
  readonly reason: string;
}

export type SourceEvidence =
  | AvailableSourceEvidence
  | UnavailableSourceEvidence;

export interface CaptureGitSourceOptions {
  readonly artifactStore: ArtifactStore;
  readonly baseline: string;
  readonly projectRoot: string;
  readonly runId: string;
}

interface GitCommandResult {
  readonly exitCode: number | null;
  readonly stderr: string;
  readonly stdout: string;
}

export async function captureGitSourceEvidence(
  options: CaptureGitSourceOptions,
): Promise<SourceEvidence> {
  const worktree = await git(options.projectRoot, [
    "rev-parse",
    "--show-toplevel",
  ]);
  if (worktree.exitCode !== 0) {
    return { available: false, reason: "not-a-git-worktree" };
  }

  const repositoryRoot = worktree.stdout.trim();
  const excludedPrefixes = artifactPrefixes(
    repositoryRoot,
    options.artifactStore.artifactRoot,
  );
  const head = await requiredGit(repositoryRoot, ["rev-parse", "HEAD"]);
  const baselineCommit = await requiredGit(repositoryRoot, [
    "rev-parse",
    options.baseline,
  ]);
  const branchResult = await git(repositoryRoot, ["branch", "--show-current"]);
  const branch = branchResult.stdout.trim();
  const version = await requiredGit(repositoryRoot, ["--version"]);

  const baselineFiles = parseNameStatus(
    await requiredGit(repositoryRoot, [
      "diff",
      "--name-status",
      "--find-renames",
      "--find-copies",
      `${baselineCommit.trim()}..HEAD`,
    ]),
    { staged: false, unstaged: false },
  );
  const stagedFiles = parseNameStatus(
    await requiredGit(repositoryRoot, [
      "diff",
      "--cached",
      "--name-status",
      "--find-renames",
      "--find-copies",
    ]),
    { staged: true, unstaged: false },
  );
  const unstagedFiles = parseNameStatus(
    await requiredGit(repositoryRoot, [
      "diff",
      "--name-status",
      "--find-renames",
      "--find-copies",
    ]),
    { staged: false, unstaged: true },
  );
  const untrackedFiles = parseUntrackedFiles(
    await requiredGit(repositoryRoot, [
      "ls-files",
      "--others",
      "--exclude-standard",
    ]),
  );

  const changedFiles = mergeChangedFiles([
    ...baselineFiles,
    ...stagedFiles,
    ...unstagedFiles,
    ...untrackedFiles,
  ]).filter((file) => !isExcluded(file.path, excludedPrefixes));
  const diff = await buildDiff(
    repositoryRoot,
    baselineCommit.trim(),
    untrackedFiles.filter((file) => !isExcluded(file.path, excludedPrefixes)),
  );

  const metadata = {
    schemaVersion: 1,
    baseline: options.baseline,
    baselineCommit: baselineCommit.trim(),
    branch: branch.length === 0 ? null : branch,
    changedFileCount: changedFiles.length,
    dirty: changedFiles.length > 0,
    gitVersion: version.trim(),
    head: head.trim(),
    repositoryRoot,
    untrackedFileCount: untrackedFiles.length,
  };

  const metadataPath = await options.artifactStore.writeJson(
    options.runId,
    "source/metadata.json",
    metadata,
  );
  const changedFilesPath = await options.artifactStore.writeJson(
    options.runId,
    "source/changed-files.json",
    changedFiles,
  );
  const diffPath = await options.artifactStore.writeText(
    options.runId,
    "source/diff.patch",
    diff,
  );

  return {
    available: true,
    baseline: options.baseline,
    baselineCommit: baselineCommit.trim(),
    branch: branch.length === 0 ? null : branch,
    changedFileCount: changedFiles.length,
    changedFiles: changedFilesPath,
    diff: diffPath,
    dirty: changedFiles.length > 0,
    head: head.trim(),
    metadata: metadataPath,
    repositoryRoot,
    untrackedFileCount: untrackedFiles.length,
  };
}

function artifactPrefixes(
  repositoryRoot: string,
  artifactRoot: string,
): readonly string[] {
  const relativePath = relative(repositoryRoot, artifactRoot)
    .split(sep)
    .join("/");
  if (
    relativePath.length === 0 ||
    relativePath === "." ||
    relativePath.startsWith("../") ||
    isAbsolute(relativePath)
  ) {
    return [];
  }
  return [`${relativePath.replace(/\/+$/u, "")}/`];
}

function isExcluded(
  path: string,
  excludedPrefixes: readonly string[],
): boolean {
  return excludedPrefixes.some((prefix) => path.startsWith(prefix));
}

async function buildDiff(
  repositoryRoot: string,
  baselineCommit: string,
  untrackedFiles: readonly ChangedFile[],
): Promise<string> {
  const sections: string[] = [];

  sections.push(
    await diffSection(
      "baseline-to-head",
      repositoryRoot,
      ["diff", "--no-ext-diff", "--unified=80", `${baselineCommit}..HEAD`],
      true,
    ),
  );
  sections.push(
    await diffSection(
      "staged",
      repositoryRoot,
      ["diff", "--cached", "--no-ext-diff", "--unified=80"],
      true,
    ),
  );
  sections.push(
    await diffSection(
      "unstaged",
      repositoryRoot,
      ["diff", "--no-ext-diff", "--unified=80"],
      true,
    ),
  );

  const untrackedDiffs: string[] = [];
  for (const file of untrackedFiles) {
    if (await isReadableTextFile(join(repositoryRoot, file.path))) {
      const result = await git(repositoryRoot, [
        "diff",
        "--no-index",
        "--",
        "/dev/null",
        file.path,
      ]);
      untrackedDiffs.push(result.stdout);
    }
  }

  sections.push(section("untracked", untrackedDiffs.join("")));

  return `${sections.join("\n")}\n`;
}

async function diffSection(
  label: string,
  repositoryRoot: string,
  args: readonly string[],
  requireSuccess: boolean,
): Promise<string> {
  const result = requireSuccess
    ? await requiredGit(repositoryRoot, args)
    : (await git(repositoryRoot, args)).stdout;
  return section(label, result);
}

function section(label: string, content: string): string {
  return `# mobtrace-diff-section: ${label}\n${content}`;
}

async function requiredGit(
  repositoryRoot: string,
  args: readonly string[],
): Promise<string> {
  const result = await git(repositoryRoot, args);
  if (result.exitCode !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr.trim() || "unknown error"}`,
    );
  }
  return result.stdout;
}

async function git(
  cwd: string,
  args: readonly string[],
): Promise<GitCommandResult> {
  const result = await executeProcess({
    args,
    cwd,
    executable: "git",
  });
  return {
    exitCode: result.exitCode,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function parseNameStatus(
  output: string,
  flags: Pick<ChangedFile, "staged" | "unstaged">,
): readonly ChangedFile[] {
  return output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => parseNameStatusLine(line, flags));
}

function parseNameStatusLine(
  line: string,
  flags: Pick<ChangedFile, "staged" | "unstaged">,
): ChangedFile {
  const [statusToken, firstPath, secondPath] = line.split("\t");
  const status = mapStatus(statusToken ?? "");
  const renamedOrCopied = status === "renamed" || status === "copied";

  return {
    path: (renamedOrCopied ? secondPath : firstPath) ?? "",
    ...(renamedOrCopied && firstPath !== undefined
      ? { previousPath: firstPath }
      : {}),
    staged: flags.staged,
    status,
    unstaged: flags.unstaged,
  };
}

function parseUntrackedFiles(output: string): readonly ChangedFile[] {
  return output
    .split("\n")
    .filter((line) => line.length > 0)
    .map((path) => ({
      path,
      staged: false,
      status: "untracked" as const,
      unstaged: false,
    }));
}

function mergeChangedFiles(
  files: readonly ChangedFile[],
): readonly ChangedFile[] {
  const byPath = new Map<string, ChangedFile>();
  for (const file of files) {
    const current = byPath.get(file.path);
    if (current === undefined) {
      byPath.set(file.path, file);
      continue;
    }

    byPath.set(file.path, {
      ...current,
      staged: current.staged || file.staged,
      unstaged: current.unstaged || file.unstaged,
    });
  }

  return [...byPath.values()].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
}

function mapStatus(token: string): SourceFileStatus {
  const status = token[0];
  switch (status) {
    case "A":
      return "added";
    case "C":
      return "copied";
    case "D":
      return "deleted";
    case "M":
      return "modified";
    case "R":
      return "renamed";
    case "T":
      return "type-changed";
    default:
      return "unknown";
  }
}

async function isReadableTextFile(path: string): Promise<boolean> {
  try {
    const content = await readFile(path);
    return !content.includes(0);
  } catch (_error) {
    return false;
  }
}
