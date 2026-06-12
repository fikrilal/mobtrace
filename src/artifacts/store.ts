import { chmod, mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import {
  type FlowResolution,
  type ManifestState,
  type PhaseResult,
  type RunManifest,
  runManifestSchema,
} from "../contracts/report.js";
import { MOBTRACE_VERSION } from "../version.js";
import { writeJsonAtomic, writeTextAtomic } from "./atomic-write.js";
import { ArtifactStoreError } from "./errors.js";
import {
  resolveRunArtifactPath,
  resolveRunDirectory,
  toRunRelativePath,
} from "./paths.js";
import { assertRunId, createRunId, type RandomBytes } from "./run-id.js";

export interface InitializeRunInput {
  deviceId?: string | null;
  flowName?: string | null;
  flowPath: string;
  flowResolution: FlowResolution;
  now?: Date;
  randomBytes?: RandomBytes;
  runId?: string;
}

export interface UpdateManifestInput {
  deviceId?: string | null;
  flowName?: string | null;
  flowPath?: string;
  flowResolution?: FlowResolution;
  phases?: readonly PhaseResult[];
  sourceControl?: "git" | null;
  state?: ManifestState;
}

export interface InitializedRun {
  directory: string;
  manifest: RunManifest;
}

function timestamp(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new ArtifactStoreError(
      "invalid-manifest",
      "Run timestamp is invalid.",
    );
  }
  return date.toISOString();
}

function parseManifest(value: unknown, path: string): RunManifest {
  const result = runManifestSchema.safeParse(value);
  if (!result.success) {
    throw new ArtifactStoreError(
      "invalid-manifest",
      `Invalid run manifest at ${path}`,
      { cause: result.error, path },
    );
  }
  return result.data;
}

export class ArtifactStore {
  readonly artifactRoot: string;

  constructor(artifactRoot: string) {
    this.artifactRoot = resolve(artifactRoot);
  }

  async initializeRun(input: InitializeRunInput): Promise<InitializedRun> {
    const now = input.now ?? new Date();
    const runId =
      input.runId === undefined
        ? createRunId(now, input.randomBytes)
        : assertRunId(input.runId);
    const directory = resolveRunDirectory(this.artifactRoot, runId);
    const manifestPath = resolveRunArtifactPath(directory, "run.json");
    const createdAt = timestamp(now);
    const manifest = parseManifest(
      {
        schemaVersion: 1,
        runId,
        state: "running",
        createdAt,
        updatedAt: createdAt,
        completedAt: null,
        mobtraceVersion: MOBTRACE_VERSION,
        project: { sourceControl: null },
        flow: {
          name: input.flowName ?? null,
          path: input.flowPath,
          resolution: input.flowResolution,
        },
        device: { id: input.deviceId ?? null },
        phases: [],
      },
      manifestPath,
    );

    try {
      await mkdir(this.artifactRoot, { mode: 0o700, recursive: true });
      await mkdir(directory, { mode: 0o700 });
      if (process.platform !== "win32") {
        await chmod(directory, 0o700);
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "EEXIST") {
        throw new ArtifactStoreError(
          "run-already-exists",
          `Run directory already exists: ${runId}`,
          { cause: error, path: directory },
        );
      }
      await rm(directory, { force: true, recursive: true }).catch(
        () => undefined,
      );
      throw new ArtifactStoreError(
        "write-failed",
        `Could not create run directory: ${directory}`,
        { cause: error, path: directory },
      );
    }

    try {
      await writeJsonAtomic(manifestPath, manifest);
      return { directory, manifest };
    } catch (error) {
      await rm(directory, { force: true, recursive: true }).catch(
        () => undefined,
      );
      throw error;
    }
  }

  async readManifest(runId: string): Promise<RunManifest> {
    const directory = resolveRunDirectory(this.artifactRoot, runId);
    const manifestPath = resolveRunArtifactPath(directory, "run.json");
    try {
      const value: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
      return parseManifest(value, manifestPath);
    } catch (error) {
      if (error instanceof ArtifactStoreError) throw error;
      if (error instanceof SyntaxError) {
        throw new ArtifactStoreError(
          "invalid-manifest",
          `Run manifest contains invalid JSON: ${runId}`,
          { cause: error, path: manifestPath },
        );
      }
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        throw new ArtifactStoreError(
          "run-not-found",
          `Run manifest was not found: ${runId}`,
          { cause: error, path: manifestPath },
        );
      }
      throw new ArtifactStoreError(
        "read-failed",
        `Could not read run manifest: ${runId}`,
        { cause: error, path: manifestPath },
      );
    }
  }

  async updateManifest(
    runId: string,
    input: UpdateManifestInput,
    now = new Date(),
  ): Promise<RunManifest> {
    const current = await this.readManifest(runId);
    if (current.state !== "running") {
      throw new ArtifactStoreError(
        "invalid-state-transition",
        `Terminal run cannot be updated: ${runId}`,
      );
    }

    const state = input.state ?? current.state;
    const updatedAt = timestamp(now);
    const directory = resolveRunDirectory(this.artifactRoot, runId);
    const manifestPath = resolveRunArtifactPath(directory, "run.json");
    const manifest = parseManifest(
      {
        ...current,
        state,
        updatedAt,
        completedAt: state === "running" ? null : updatedAt,
        project: {
          sourceControl:
            input.sourceControl === undefined
              ? current.project.sourceControl
              : input.sourceControl,
        },
        flow: {
          name:
            input.flowName === undefined ? current.flow.name : input.flowName,
          path: input.flowPath ?? current.flow.path,
          resolution: input.flowResolution ?? current.flow.resolution,
        },
        device: {
          id: input.deviceId === undefined ? current.device.id : input.deviceId,
        },
        phases: input.phases ?? current.phases,
      },
      manifestPath,
    );

    await writeJsonAtomic(manifestPath, manifest);
    return manifest;
  }

  async writeText(
    runId: string,
    portablePath: string,
    content: string,
  ): Promise<string> {
    await this.readManifest(runId);
    const directory = resolveRunDirectory(this.artifactRoot, runId);
    const targetPath = resolveRunArtifactPath(directory, portablePath);
    await writeTextAtomic(targetPath, content);
    return toRunRelativePath(directory, targetPath);
  }

  async writeJson(
    runId: string,
    portablePath: string,
    value: unknown,
  ): Promise<string> {
    await this.readManifest(runId);
    const directory = resolveRunDirectory(this.artifactRoot, runId);
    const targetPath = resolveRunArtifactPath(directory, portablePath);
    await writeJsonAtomic(targetPath, value);
    return toRunRelativePath(directory, targetPath);
  }
}
