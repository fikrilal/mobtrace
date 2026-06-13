import { dirname } from "node:path";

import { ArtifactStore } from "../artifacts/store.js";
import { MobtraceCommandError } from "../cli-error.js";
import { loadConfiguration } from "../configuration/load.js";
import { generateInitialReports } from "../report/initial.js";
import { MaestroRunner } from "../runner/maestro.js";
import { runVerifyLifecycle } from "../verify/lifecycle.js";
import type { CommandIo } from "./io.js";

export interface VerifyCommandOptions {
  readonly artifacts?: string | undefined;
  readonly baseline?: string | undefined;
  readonly config?: string | undefined;
  readonly device?: string | undefined;
  readonly flow: string;
  readonly json?: boolean | undefined;
  readonly project?: string | undefined;
}

export async function runVerifyCommand(
  options: VerifyCommandOptions,
  io: CommandIo,
): Promise<void> {
  const { configuration, projectRoot } = await loadConfiguration({
    ...(options.config === undefined ? {} : { configPath: options.config }),
    ...(options.project === undefined ? {} : { projectPath: options.project }),
  });
  const lifecycle = await runVerifyLifecycle({
    configuration,
    flow: options.flow,
    journeyRunner: new MaestroRunner(),
    projectRoot,
    ...(options.artifacts === undefined
      ? {}
      : { artifactOverride: options.artifacts }),
    ...(options.baseline === undefined ? {} : { baseline: options.baseline }),
    ...(options.device === undefined ? {} : { device: options.device }),
  });
  const reports = await generateInitialReports(
    new ArtifactStore(dirname(lifecycle.runDirectory)),
    lifecycle,
  );

  io.stdout.write(
    options.json === true
      ? `${JSON.stringify(reports.result)}\n`
      : reports.compact,
  );

  if (lifecycle.exitCode !== 0) {
    throw new MobtraceCommandError("", lifecycle.exitCode);
  }
}
