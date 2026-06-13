import { dirname } from "node:path";

import { ArtifactStore } from "../artifacts/store.js";
import { MobtraceCommandError } from "../cli-error.js";
import { loadConfiguration } from "../configuration/load.js";
import {
  createDiagnosisContext,
  writeDiagnosisContext,
} from "../diagnosis/context.js";
import { normalizeLifecycleEvidence } from "../evidence/normalized.js";
import { generateBaselineReports } from "../report/baseline.js";
import { MaestroRunner } from "../runner/maestro.js";
import { createRunRedactor } from "../security/redaction.js";
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
  const interruption = new AbortController();
  const interrupt = (): void => interruption.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    await executeVerify(options, io, interruption.signal);
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
}

async function executeVerify(
  options: VerifyCommandOptions,
  io: CommandIo,
  abortSignal: AbortSignal,
): Promise<void> {
  const { configuration, projectRoot } = await loadConfiguration({
    ...(options.config === undefined ? {} : { configPath: options.config }),
    ...(options.project === undefined ? {} : { projectPath: options.project }),
  });
  const diagnosisContext = await createDiagnosisContext(
    projectRoot,
    configuration.config,
    configuration.config?.flows?.[options.flow]?.owns ?? [],
  );
  const lifecycle = await runVerifyLifecycle({
    abortSignal,
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
  const artifactStore = new ArtifactStore(dirname(lifecycle.runDirectory));
  await writeDiagnosisContext(artifactStore, lifecycle.runId, diagnosisContext);
  const normalized = await normalizeLifecycleEvidence(
    artifactStore,
    lifecycle,
    createRunRedactor(diagnosisContext.redaction, lifecycle.flow.environment),
  );
  const reports = await generateBaselineReports(
    artifactStore,
    normalized.evidence,
    diagnosisContext,
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
