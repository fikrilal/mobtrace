import { stat } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";

import { ConfigurationError } from "./errors.js";
import type { ConfigurationDiscovery } from "./load.js";
import { resolveProjectPath } from "./load.js";
import { parseDuration, type ResolvedDuration } from "./duration.js";
import type {
  ConfiguredEnvironment,
  ConfiguredHooks,
  MobtraceConfig,
} from "./schema.js";

export interface FlowResolutionOptions {
  readonly baseline?: string | undefined;
  readonly device?: string | undefined;
  readonly flow: string;
  readonly processEnv?: NodeJS.ProcessEnv | undefined;
}

export interface ResolvedEnvironmentEntry {
  readonly sensitive: boolean;
  readonly source: "literal" | "process";
  readonly value: string;
}

export interface ResolvedFlowInvocation {
  readonly artifactRoot: string;
  readonly baseline: string | undefined;
  readonly device: string | undefined;
  readonly environment: ReadonlyMap<string, ResolvedEnvironmentEntry>;
  readonly flowName: string | null;
  readonly flowHooks: ConfiguredHooks | undefined;
  readonly flowPath: string;
  readonly flowPathRelative: string;
  readonly maestroExecutable: string;
  readonly ownership: readonly string[];
  readonly projectHooks: ConfiguredHooks | undefined;
  readonly resolution: "configured" | "path";
  readonly timeout: ResolvedDuration | undefined;
}

export async function resolveFlowInvocation(
  projectRoot: string,
  discovery: ConfigurationDiscovery,
  options: FlowResolutionOptions,
): Promise<ResolvedFlowInvocation> {
  const config = discovery.config;
  const configuredFlow = config?.flows?.[options.flow];

  if (configuredFlow !== undefined) {
    const flowEnvironment = mergeEnvironment(
      config?.environment,
      configuredFlow.environment,
      options.processEnv ?? process.env,
    );

    return freezeInvocation({
      artifactRoot: resolveConfiguredPath(
        projectRoot,
        config?.artifacts?.root ?? ".mobtrace/runs",
      ),
      baseline:
        options.baseline ??
        configuredFlow.baseline ??
        config?.defaults?.baseline,
      device:
        options.device ?? configuredFlow.device ?? config?.defaults?.device,
      environment: flowEnvironment,
      flowName: options.flow,
      flowHooks: configuredFlow.hooks,
      flowPath: resolveProjectPath(projectRoot, configuredFlow.path),
      flowPathRelative: configuredFlow.path,
      maestroExecutable: resolveMaestroExecutable(projectRoot, config),
      ownership: configuredFlow.owns ?? [],
      projectHooks: config?.hooks,
      resolution: "configured",
      timeout: resolveTimeout(
        config?.defaults?.timeout,
        configuredFlow.timeout,
      ),
    });
  }

  const directFlowPath = resolveProjectPath(projectRoot, options.flow);
  if (!(await isFileOrDirectory(directFlowPath))) {
    throw new ConfigurationError(
      `Flow '${options.flow}' is not a configured flow or existing path.`,
    );
  }

  return freezeInvocation({
    artifactRoot: resolveConfiguredPath(
      projectRoot,
      config?.artifacts?.root ?? ".mobtrace/runs",
    ),
    baseline: options.baseline ?? config?.defaults?.baseline,
    device: options.device ?? config?.defaults?.device,
    environment: mergeEnvironment(
      config?.environment,
      undefined,
      options.processEnv ?? process.env,
    ),
    flowName: null,
    flowHooks: undefined,
    flowPath: directFlowPath,
    flowPathRelative: toProjectRelative(projectRoot, directFlowPath),
    maestroExecutable: resolveMaestroExecutable(projectRoot, config),
    ownership: [],
    projectHooks: config?.hooks,
    resolution: "path",
    timeout: resolveTimeout(config?.defaults?.timeout, undefined),
  });
}

function resolveConfiguredPath(projectRoot: string, value: string): string {
  return resolveProjectPath(projectRoot, value);
}

function resolveMaestroExecutable(
  projectRoot: string,
  config: MobtraceConfig | null,
): string {
  const executable = config?.maestro?.executable ?? "maestro";
  if (executable.includes("/") || executable.includes("\\")) {
    return resolveProjectPath(projectRoot, executable);
  }

  return executable;
}

function resolveTimeout(
  projectTimeout: string | undefined,
  flowTimeout: string | undefined,
): ResolvedDuration | undefined {
  const value = flowTimeout ?? projectTimeout;
  return value === undefined ? undefined : parseDuration(value);
}

function mergeEnvironment(
  projectEnvironment: ConfiguredEnvironment | undefined,
  flowEnvironment: ConfiguredEnvironment | undefined,
  processEnv: NodeJS.ProcessEnv,
): ReadonlyMap<string, ResolvedEnvironmentEntry> {
  const entries = new Map<string, ResolvedEnvironmentEntry>();

  applyEnvironment(entries, projectEnvironment, processEnv);
  applyEnvironment(entries, flowEnvironment, processEnv);

  return entries;
}

function applyEnvironment(
  target: Map<string, ResolvedEnvironmentEntry>,
  source: ConfiguredEnvironment | undefined,
  processEnv: NodeJS.ProcessEnv,
): void {
  if (source === undefined) {
    return;
  }

  for (const [name, entry] of Object.entries(source)) {
    if ("value" in entry) {
      target.set(name, {
        sensitive: false,
        source: "literal",
        value: entry.value,
      });
      continue;
    }

    const value = processEnv[entry.fromEnv];
    if (value === undefined) {
      throw new ConfigurationError(
        `Environment variable '${entry.fromEnv}' is required for '${name}'.`,
      );
    }

    target.set(name, {
      sensitive: true,
      source: "process",
      value,
    });
  }
}

async function isFileOrDirectory(path: string): Promise<boolean> {
  try {
    const value = await stat(path);
    return value.isFile() || value.isDirectory();
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return false;
    }

    throw error;
  }
}

function toProjectRelative(projectRoot: string, path: string): string {
  const relativePath = relative(projectRoot, path).replaceAll("\\", "/");
  if (relativePath === "") {
    return basename(path);
  }

  return relativePath.startsWith("..") ? resolve(path) : relativePath;
}

function freezeInvocation(
  value: ResolvedFlowInvocation,
): ResolvedFlowInvocation {
  return Object.freeze({
    ...value,
    environment: new Map(value.environment),
    ownership: Object.freeze([...value.ownership]),
  });
}
