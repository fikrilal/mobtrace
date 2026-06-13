import { constants } from "node:fs";
import { access, mkdir, stat } from "node:fs/promises";
import { dirname, delimiter, isAbsolute, resolve } from "node:path";

import { MobtraceCommandError } from "../cli-error.js";
import {
  discoverConfiguration,
  resolveProjectPath,
  resolveProjectRoot,
} from "../configuration/load.js";
import type {
  ConfiguredHook,
  MobtraceConfig,
} from "../configuration/schema.js";
import {
  type DoctorCheck,
  type DoctorResult,
  doctorResultSchema,
} from "../contracts/report.js";
import { platformSupport } from "../platform/support.js";
import { MOBTRACE_VERSION } from "../version.js";
import type { CommandIo } from "./io.js";

export interface DoctorCommandOptions {
  readonly config?: string | undefined;
  readonly cwd?: string | undefined;
  readonly device?: string | undefined;
  readonly json?: boolean | undefined;
  readonly project?: string | undefined;
}

interface DoctorContext {
  readonly checks: DoctorCheck[];
  readonly projectRoot: string;
}

export async function runDoctorCommand(
  options: DoctorCommandOptions,
  io: CommandIo,
): Promise<void> {
  const context = await collectDoctorChecks(options);
  const result = createDoctorResult(context.checks);

  if (options.json === true) {
    io.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    io.stdout.write(renderDoctorResult(result));
  }

  if (!result.ready) {
    throw new MobtraceCommandError("", doctorExitCode(result));
  }
}

async function collectDoctorChecks(
  options: DoctorCommandOptions,
): Promise<DoctorContext> {
  const checks: DoctorCheck[] = [];
  const projectRoot = resolveProjectRoot(options.project, options.cwd);
  const host = platformSupport();
  checks.push(
    host.supported
      ? passedCheck("platform", true, `${host.platform}: ${host.reason}`)
      : failedCheck(
          "platform",
          true,
          host.reason,
          "Run MobTrace on a supported Linux or macOS host.",
        ),
  );

  if (!(await isDirectory(projectRoot))) {
    checks.push(
      failedCheck(
        "project",
        true,
        `Project root is not available: ${projectRoot}`,
        "Pass --project with an existing directory.",
      ),
    );

    checks.push(
      skippedCheck("configuration", false, "Project root is missing."),
    );
    checks.push(skippedCheck("git", true, "Project root is missing."));
    checks.push(skippedCheck("maestro", true, "Project root is missing."));
    checks.push(skippedCheck("flow", false, "Project root is missing."));
    checks.push(skippedCheck("hooks", false, "Project root is missing."));
    checks.push(skippedCheck("artifacts", true, "Project root is missing."));
    checks.push(deviceCheck(options.device));

    return { checks, projectRoot };
  }

  checks.push(passedCheck("project", true, projectRoot));

  let config: MobtraceConfig | null = null;
  let configurationInvalid = false;
  try {
    const discovery = await discoverConfiguration(projectRoot, options.config);
    config = discovery.config;
    if (discovery.kind === "none") {
      checks.push(
        skippedCheck(
          "configuration",
          false,
          "No mobtrace.yaml found; zero-configuration mode is available.",
        ),
      );
    } else {
      checks.push(passedCheck("configuration", true, discovery.path));
    }
  } catch (error) {
    configurationInvalid = true;
    checks.push(
      failedCheck(
        "configuration",
        true,
        error instanceof Error ? error.message : "Configuration is invalid.",
        "Fix mobtrace.yaml before running MobTrace commands.",
      ),
    );
  }

  checks.push(await commandCheck("git", "git", projectRoot, true));

  if (configurationInvalid) {
    checks.push(skippedCheck("maestro", true, "Configuration is invalid."));
    checks.push(skippedCheck("flow", false, "Configuration is invalid."));
    checks.push(skippedCheck("hooks", false, "Configuration is invalid."));
    checks.push(skippedCheck("artifacts", true, "Configuration is invalid."));
    checks.push(deviceCheck(options.device));

    return { checks, projectRoot };
  }

  checks.push(
    await commandCheck(
      "maestro",
      config?.maestro?.executable ?? "maestro",
      projectRoot,
      true,
    ),
  );
  checks.push(await flowCheck(projectRoot, config));
  checks.push(await hooksCheck(projectRoot, config));
  checks.push(await artifactsCheck(projectRoot, config));
  checks.push(deviceCheck(options.device));

  return { checks, projectRoot };
}

function createDoctorResult(checks: readonly DoctorCheck[]): DoctorResult {
  return doctorResultSchema.parse({
    checks,
    generatedAt: new Date().toISOString(),
    mobtraceVersion: MOBTRACE_VERSION,
    ready: checks.every(
      (check) => !check.required || check.status === "passed",
    ),
    schemaVersion: 1,
  });
}

function renderDoctorResult(result: DoctorResult): string {
  const lines: string[] = [];
  for (const check of result.checks) {
    lines.push(
      `${check.status.toUpperCase().padEnd(5)} ${check.id.padEnd(13)} ${check.summary}`,
    );
    if (check.status === "failed" && check.remediation !== null) {
      lines.push(`      ${check.remediation}`);
    }
  }

  lines.push("");
  lines.push(result.ready ? "MobTrace is ready." : "MobTrace is not ready.");
  lines.push("");

  return lines.join("\n");
}

function doctorExitCode(result: DoctorResult): number {
  const invalidConfiguration = result.checks.some(
    (check) => check.id === "configuration" && check.status === "failed",
  );
  const invalidProject = result.checks.some(
    (check) => check.id === "project" && check.status === "failed",
  );

  return invalidConfiguration || invalidProject ? 2 : 3;
}

async function flowCheck(
  projectRoot: string,
  config: MobtraceConfig | null,
): Promise<DoctorCheck> {
  const flows = config?.flows;
  if (flows === undefined || Object.keys(flows).length === 0) {
    return skippedCheck("flow", false, "No configured flows.");
  }

  const missing = [];
  for (const [name, flow] of Object.entries(flows)) {
    if (
      !(await isFileOrDirectory(resolveProjectPath(projectRoot, flow.path)))
    ) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    return failedCheck(
      "flow",
      true,
      `Missing configured flow path for: ${missing.join(", ")}`,
      "Update mobtrace.yaml so every configured flow points to an existing file or directory.",
    );
  }

  return passedCheck("flow", true, `${Object.keys(flows).length} configured`);
}

async function hooksCheck(
  projectRoot: string,
  config: MobtraceConfig | null,
): Promise<DoctorCheck> {
  const hooks = collectHooks(config);
  if (hooks.length === 0) {
    return skippedCheck("hooks", false, "No configured hooks.");
  }

  const missing = [];
  for (const hook of hooks) {
    const executable = hook.command[0];
    if (
      executable === undefined ||
      !(await commandAvailable(executable, projectRoot))
    ) {
      missing.push(executable ?? "<empty>");
    }
  }

  if (missing.length > 0) {
    return failedCheck(
      "hooks",
      true,
      `Hook command not found: ${missing.join(", ")}`,
      "Install the hook command or update the configured hook executable.",
    );
  }

  return passedCheck("hooks", true, `${hooks.length} configured`);
}

async function artifactsCheck(
  projectRoot: string,
  config: MobtraceConfig | null,
): Promise<DoctorCheck> {
  const root = resolveProjectPath(
    projectRoot,
    config?.artifacts?.root ?? ".mobtrace/runs",
  );

  try {
    const value = await stat(root).catch(() => null);
    if (value !== null) {
      if (!value.isDirectory()) {
        return failedCheck(
          "artifacts",
          true,
          `Artifact root is not a directory: ${root}`,
          "Set artifacts.root to a writable directory path.",
        );
      }
      await access(root, constants.W_OK);
      return passedCheck("artifacts", true, "writable");
    }

    await mkdir(dirname(root), { recursive: true });
    await access(dirname(root), constants.W_OK);
    return passedCheck("artifacts", true, "writable");
  } catch (error) {
    return failedCheck(
      "artifacts",
      true,
      `Artifact root is not writable: ${root}`,
      error instanceof Error
        ? error.message
        : "Choose a writable artifact root.",
    );
  }
}

async function commandCheck(
  id: string,
  executable: string,
  projectRoot: string,
  required: boolean,
): Promise<DoctorCheck> {
  if (await commandAvailable(executable, projectRoot)) {
    return passedCheck(id, required, executable);
  }

  return failedCheck(
    id,
    required,
    `${executable} was not found.`,
    `Install ${id} and ensure \`${executable}\` is available on PATH or configured as an executable path.`,
  );
}

function deviceCheck(device: string | undefined): DoctorCheck {
  if (device === undefined) {
    return skippedCheck("device", false, "No device requested.");
  }

  return skippedCheck(
    "device",
    false,
    `Device probing is deferred for ${device}.`,
  );
}

function collectHooks(config: MobtraceConfig | null): ConfiguredHook[] {
  const hooks: ConfiguredHook[] = [];

  if (config?.hooks?.prepare !== undefined) {
    hooks.push(config.hooks.prepare);
  }
  if (config?.hooks?.cleanup !== undefined) {
    hooks.push(config.hooks.cleanup);
  }

  for (const flow of Object.values(config?.flows ?? {})) {
    if (flow.hooks?.prepare !== undefined) {
      hooks.push(flow.hooks.prepare);
    }
    if (flow.hooks?.cleanup !== undefined) {
      hooks.push(flow.hooks.cleanup);
    }
  }

  return hooks;
}

async function commandAvailable(
  executable: string,
  projectRoot: string,
): Promise<boolean> {
  if (executable.includes("/") || executable.includes("\\")) {
    return isExecutable(resolveProjectPath(projectRoot, executable));
  }

  for (const entry of (process.env.PATH ?? "").split(delimiter)) {
    if (entry === "") {
      continue;
    }
    if (await isExecutable(resolve(entry, executable))) {
      return true;
    }
  }

  return false;
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(isAbsolute(path) ? path : resolve(path), constants.X_OK);
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "EACCES"
    ) {
      return false;
    }

    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (_error) {
    return false;
  }
}

async function isFileOrDirectory(path: string): Promise<boolean> {
  try {
    const value = await stat(path);
    return value.isFile() || value.isDirectory();
  } catch (_error) {
    return false;
  }
}

function passedCheck(
  id: string,
  required: boolean,
  summary: string,
): DoctorCheck {
  return {
    id,
    remediation: null,
    required,
    status: "passed",
    summary,
  };
}

function failedCheck(
  id: string,
  required: boolean,
  summary: string,
  remediation: string,
): DoctorCheck {
  return {
    id,
    remediation,
    required,
    status: "failed",
    summary,
  };
}

function skippedCheck(
  id: string,
  required: boolean,
  summary: string,
): DoctorCheck {
  return {
    id,
    remediation: null,
    required,
    status: "skipped",
    summary,
  };
}
