import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import { writeTextAtomic } from "../artifacts/atomic-write.js";
import { MobtraceCommandError } from "../cli-error.js";
import {
  MOBTRACE_CONFIG_FILENAME,
  resolveProjectPath,
  resolveProjectRoot,
} from "../configuration/load.js";
import type { CommandIo } from "./io.js";

const starterConfiguration = `version: 1

flows:
  # Replace this with an existing Maestro flow path.
  example:
    path: .maestro/flows/example.yaml
`;

export interface InitCommandOptions {
  readonly config?: string | undefined;
  readonly cwd?: string | undefined;
  readonly force?: boolean | undefined;
  readonly project?: string | undefined;
}

export async function runInitCommand(
  options: InitCommandOptions,
  io: CommandIo,
): Promise<void> {
  const projectRoot = resolveProjectRoot(options.project, options.cwd);
  await assertDirectory(projectRoot);

  const configurationPath =
    options.config === undefined
      ? resolve(projectRoot, MOBTRACE_CONFIG_FILENAME)
      : resolveProjectPath(projectRoot, options.config);

  if (!options.force && (await pathExists(configurationPath))) {
    throw new MobtraceCommandError(
      `Configuration already exists: ${configurationPath}\nUse --force to replace it.`,
      2,
    );
  }

  await writeTextAtomic(configurationPath, starterConfiguration);

  io.stdout.write(`Created ${configurationPath}\n`);
  io.stdout.write("Next: set a flow, then run `mobtrace doctor`.\n");
}

async function assertDirectory(path: string): Promise<void> {
  try {
    const value = await stat(path);
    if (!value.isDirectory()) {
      throw new MobtraceCommandError(
        `Project root is not a directory: ${path}`,
        2,
      );
    }
  } catch (error) {
    if (error instanceof MobtraceCommandError) {
      throw error;
    }

    throw new MobtraceCommandError(`Project root does not exist: ${path}`, 2);
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
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
