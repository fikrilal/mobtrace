import { isAbsolute, relative, resolve, sep, win32 } from "node:path";

import { portablePathSchema } from "../contracts/report.js";
import { ArtifactStoreError } from "./errors.js";
import { assertRunId } from "./run-id.js";

export function resolveArtifactRoot(
  projectRoot: string,
  configuredRoot = ".mobtrace/runs",
): string {
  return isAbsolute(configuredRoot)
    ? resolve(configuredRoot)
    : resolve(projectRoot, configuredRoot);
}

export function resolveRunDirectory(
  artifactRoot: string,
  runId: string,
): string {
  return resolve(artifactRoot, assertRunId(runId));
}

export function assertPortablePath(value: string): string {
  const result = portablePathSchema.safeParse(value);
  if (!result.success || win32.isAbsolute(value)) {
    throw new ArtifactStoreError(
      "invalid-path",
      `Invalid portable artifact path: ${value}`,
      { cause: result.success ? undefined : result.error, path: value },
    );
  }
  return result.data;
}

function isOutside(root: string, target: string): boolean {
  const path = relative(root, target);
  return (
    path === ".." ||
    path.startsWith(`..${sep}`) ||
    isAbsolute(path) ||
    win32.isAbsolute(path)
  );
}

export function resolveRunArtifactPath(
  runDirectory: string,
  portablePath: string,
): string {
  const checkedPath = assertPortablePath(portablePath);
  const target = resolve(runDirectory, ...checkedPath.split("/"));
  if (isOutside(resolve(runDirectory), target)) {
    throw new ArtifactStoreError(
      "invalid-path",
      `Artifact path resolves outside the run directory: ${portablePath}`,
      { path: portablePath },
    );
  }
  return target;
}

export function toRunRelativePath(
  runDirectory: string,
  targetPath: string,
): string {
  const root = resolve(runDirectory);
  const target = resolve(targetPath);
  if (isOutside(root, target) || root === target) {
    throw new ArtifactStoreError(
      "invalid-path",
      `Path is not a file below the run directory: ${targetPath}`,
      { path: targetPath },
    );
  }
  return assertPortablePath(relative(root, target).split(sep).join("/"));
}
