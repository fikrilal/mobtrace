import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve } from "node:path";

import { ArtifactStore } from "../artifacts/store.js";
import {
  resolveRunArtifactPath,
  resolveRunDirectory,
} from "../artifacts/paths.js";
import { finalResultSchema, runIdSchema } from "../contracts/report.js";
import {
  type DiagnosisContext,
  diagnosisContextSchema,
} from "../diagnosis/context.js";
import {
  type NormalizedEvidence,
  normalizedEvidenceSchema,
} from "../evidence/normalized.js";
import {
  type BaselineReportResult,
  generateBaselineReports,
  renderCompact,
} from "./baseline.js";

export class HistoricalReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoricalReportError";
  }
}

export interface ResolvedHistoricalRun {
  readonly directory: string;
  readonly runId: string;
  readonly store: ArtifactStore;
}

export async function resolveHistoricalRun(
  projectRoot: string,
  artifactRoot: string,
  run = "latest",
): Promise<ResolvedHistoricalRun> {
  if (run === "latest") {
    return resolveLatestRun(artifactRoot);
  }

  if (runIdSchema.safeParse(run).success) {
    const store = new ArtifactStore(artifactRoot);
    await requireManifest(store, run);
    return {
      directory: resolveRunDirectory(store.artifactRoot, run),
      runId: run,
      store,
    };
  }

  const directory = isAbsolute(run) ? resolve(run) : resolve(projectRoot, run);
  if (!(await isDirectory(directory))) {
    throw new HistoricalReportError(`Run was not found: ${run}`);
  }

  const runId = basename(directory);
  if (!runIdSchema.safeParse(runId).success) {
    throw new HistoricalReportError(
      `Artifact directory name is not a MobTrace run ID: ${directory}`,
    );
  }

  const store = new ArtifactStore(dirname(directory));
  const manifest = await requireManifest(store, runId);
  if (manifest.runId !== runId) {
    throw new HistoricalReportError(`Run manifest does not match ${runId}.`);
  }

  return { directory, runId, store };
}

export async function loadOrRegenerateReports(
  run: ResolvedHistoricalRun,
): Promise<BaselineReportResult> {
  const normalized = normalizedEvidenceSchema.parse(
    await run.store.readJson(run.runId, "evidence/normalized.json"),
  );
  const context = await readDiagnosisContext(run);
  const existing = await readFreshReports(run, normalized);
  if (existing !== null) {
    return existing;
  }

  return generateBaselineReports(run.store, normalized, context);
}

async function resolveLatestRun(
  artifactRoot: string,
): Promise<ResolvedHistoricalRun> {
  const store = new ArtifactStore(artifactRoot);
  let entries: Dirent[];
  try {
    entries = await readdir(store.artifactRoot, { withFileTypes: true });
  } catch (error) {
    throw new HistoricalReportError(
      error instanceof Error
        ? `Could not inspect artifact root: ${error.message}`
        : "Could not inspect artifact root.",
    );
  }

  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !runIdSchema.safeParse(entry.name).success) {
      continue;
    }
    try {
      const manifest = await store.readManifest(entry.name);
      candidates.push(manifest);
    } catch (_error) {
      // Ignore directories that are not readable MobTrace runs.
    }
  }

  candidates.sort((left, right) => {
    const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
    return byCreatedAt === 0
      ? right.runId.localeCompare(left.runId)
      : byCreatedAt;
  });
  const latest = candidates[0];
  if (latest === undefined) {
    throw new HistoricalReportError("No MobTrace runs were found.");
  }

  return {
    directory: resolveRunDirectory(store.artifactRoot, latest.runId),
    runId: latest.runId,
    store,
  };
}

async function readFreshReports(
  run: ResolvedHistoricalRun,
  normalized: NormalizedEvidence,
): Promise<BaselineReportResult | null> {
  const normalizedPath = resolveRunArtifactPath(
    run.directory,
    "evidence/normalized.json",
  );
  const contextPath = resolveRunArtifactPath(
    run.directory,
    "evidence/diagnosis-context.json",
  );
  const resultPath = resolveRunArtifactPath(run.directory, "result.json");
  const markdownPath = resolveRunArtifactPath(run.directory, "report.md");

  try {
    const [normalizedStat, contextStat, resultStat, markdownStat] =
      await Promise.all([
        stat(normalizedPath),
        stat(contextPath).catch(() => normalizedStatFallback()),
        stat(resultPath),
        stat(markdownPath),
      ]);
    if (
      resultStat.mtimeMs < normalizedStat.mtimeMs ||
      markdownStat.mtimeMs < normalizedStat.mtimeMs ||
      resultStat.mtimeMs < contextStat.mtimeMs ||
      markdownStat.mtimeMs < contextStat.mtimeMs
    ) {
      return null;
    }

    const result = finalResultSchema.parse(
      await run.store.readJson(run.runId, "result.json"),
    );
    if (result.sourceRunCompletedAt !== normalized.run.completedAt) {
      return null;
    }
    const markdown = await run.store.readText(run.runId, "report.md");

    return {
      compact: renderCompact(result),
      jsonPath: "result.json",
      markdownPath: "report.md",
      result,
      markdown,
    };
  } catch (_error) {
    return null;
  }
}

function normalizedStatFallback(): { readonly mtimeMs: number } {
  return { mtimeMs: 0 };
}

async function requireManifest(
  store: ArtifactStore,
  runId: string,
): Promise<Awaited<ReturnType<ArtifactStore["readManifest"]>>> {
  try {
    return await store.readManifest(runId);
  } catch (error) {
    throw new HistoricalReportError(
      error instanceof Error ? error.message : `Run was not found: ${runId}`,
    );
  }
}

async function readDiagnosisContext(
  run: ResolvedHistoricalRun,
): Promise<DiagnosisContext> {
  try {
    return diagnosisContextSchema.parse(
      await run.store.readJson(run.runId, "evidence/diagnosis-context.json"),
    );
  } catch (_error) {
    return {
      ownership: [],
      redaction: {
        environmentNames: [],
        patterns: [],
        schemaVersion: 1,
      },
      ruleSetVersion: 1,
      schemaVersion: 1,
      signatures: [],
    };
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (_error) {
    return false;
  }
}
