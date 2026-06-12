import type { Stats } from "node:fs";
import { readFile as readFileAsync, stat as statAsync } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { parseDocument } from "yaml";
import { ZodError } from "zod";

import { ConfigurationError } from "./errors.js";
import { type MobtraceConfig, mobtraceConfigSchema } from "./schema.js";

export const MOBTRACE_CONFIG_FILENAME = "mobtrace.yaml";

export interface LoadedConfiguration {
  readonly config: MobtraceConfig;
  readonly kind: "explicit" | "project";
  readonly path: string;
}

export interface MissingConfiguration {
  readonly config: null;
  readonly kind: "none";
  readonly path: null;
}

export type ConfigurationDiscovery = LoadedConfiguration | MissingConfiguration;

export interface LoadConfigurationOptions {
  readonly configPath?: string;
  readonly cwd?: string;
  readonly projectPath?: string;
}

export function resolveProjectRoot(
  projectPath: string | undefined,
  cwd = process.cwd(),
): string {
  return resolve(cwd, projectPath ?? ".");
}

export function resolveProjectPath(projectRoot: string, value: string): string {
  return isAbsolute(value) ? value : resolve(projectRoot, value);
}

export async function discoverConfiguration(
  projectRoot: string,
  configPath?: string,
): Promise<ConfigurationDiscovery> {
  if (configPath !== undefined) {
    const resolvedPath = resolveProjectPath(projectRoot, configPath);
    await assertRegularFile(resolvedPath, "Explicit configuration");

    return {
      config: await readConfigurationFile(resolvedPath),
      kind: "explicit",
      path: resolvedPath,
    };
  }

  const projectConfigPath = resolve(projectRoot, MOBTRACE_CONFIG_FILENAME);
  if (!(await isRegularFile(projectConfigPath))) {
    return {
      config: null,
      kind: "none",
      path: null,
    };
  }

  return {
    config: await readConfigurationFile(projectConfigPath),
    kind: "project",
    path: projectConfigPath,
  };
}

export async function loadConfiguration(
  options: LoadConfigurationOptions = {},
): Promise<{
  readonly configuration: ConfigurationDiscovery;
  readonly projectRoot: string;
}> {
  const projectRoot = resolveProjectRoot(options.projectPath, options.cwd);
  await assertDirectory(projectRoot, "Project root");

  return {
    configuration: await discoverConfiguration(projectRoot, options.configPath),
    projectRoot,
  };
}

async function readConfigurationFile(path: string): Promise<MobtraceConfig> {
  let contents: string;
  try {
    contents = await readFileAsync(path, "utf8");
  } catch (error) {
    throw toConfigurationError(error, `Unable to read configuration: ${path}`);
  }

  const document = parseDocument(contents, { prettyErrors: false });
  if (document.errors.length > 0) {
    const firstError = document.errors[0];
    throw new ConfigurationError(
      `Invalid YAML in ${path}: ${firstError?.message ?? "parse failed"}`,
      path,
    );
  }

  try {
    return mobtraceConfigSchema.parse(document.toJS());
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ConfigurationError(formatZodError(error, path), path);
    }

    throw error;
  }
}

function formatZodError(error: ZodError, path: string): string {
  const firstIssue = error.issues[0];
  if (firstIssue === undefined) {
    return `Invalid configuration: ${path}`;
  }

  const fieldPath =
    firstIssue.path.length === 0 ? "<root>" : firstIssue.path.join(".");

  return `Invalid configuration in ${path} at ${fieldPath}: ${firstIssue.message}`;
}

async function assertRegularFile(path: string, label: string): Promise<void> {
  if (!(await isRegularFile(path))) {
    throw new ConfigurationError(
      `${label} is not a regular file: ${path}`,
      path,
    );
  }
}

async function assertDirectory(path: string, label: string): Promise<void> {
  let value: Stats;
  try {
    value = await statAsync(path);
  } catch (error) {
    throw toConfigurationError(error, `${label} does not exist: ${path}`);
  }

  if (!value.isDirectory()) {
    throw new ConfigurationError(`${label} is not a directory: ${path}`, path);
  }
}

async function isRegularFile(path: string): Promise<boolean> {
  try {
    return (await statAsync(path)).isFile();
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }

    throw toConfigurationError(error, `Unable to inspect path: ${path}`);
  }
}

function toConfigurationError(
  error: unknown,
  fallback: string,
): ConfigurationError {
  if (error instanceof ConfigurationError) {
    return error;
  }

  if (error instanceof Error) {
    return new ConfigurationError(`${fallback}: ${error.message}`);
  }

  return new ConfigurationError(fallback);
}

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
