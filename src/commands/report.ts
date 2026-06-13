import { resolveArtifactRoot } from "../artifacts/paths.js";
import { MobtraceCommandError } from "../cli-error.js";
import { loadConfiguration } from "../configuration/load.js";
import {
  HistoricalReportError,
  loadOrRegenerateReports,
  resolveHistoricalRun,
} from "../report/history.js";
import type { ResolvedHistoricalRun } from "../report/history.js";
import type { BaselineReportResult } from "../report/baseline.js";
import type { CommandIo } from "./io.js";

export interface ReportCommandOptions {
  readonly config?: string | undefined;
  readonly full?: boolean | undefined;
  readonly json?: boolean | undefined;
  readonly project?: string | undefined;
  readonly run?: string | undefined;
}

export async function runReportCommand(
  options: ReportCommandOptions,
  io: CommandIo,
): Promise<void> {
  if (options.json === true && options.full === true) {
    throw new MobtraceCommandError(
      "--json and --full are mutually exclusive.",
      2,
    );
  }

  const { configuration, projectRoot } = await loadConfiguration({
    ...(options.config === undefined ? {} : { configPath: options.config }),
    ...(options.project === undefined ? {} : { projectPath: options.project }),
  });
  const artifactRoot = resolveArtifactRoot(
    projectRoot,
    configuration.config?.artifacts?.root,
  );

  let run: ResolvedHistoricalRun;
  try {
    run = await resolveHistoricalRun(
      projectRoot,
      artifactRoot,
      options.run ?? "latest",
    );
  } catch (error) {
    if (error instanceof HistoricalReportError) {
      throw new MobtraceCommandError(error.message, 2);
    }
    throw error;
  }

  let reports: BaselineReportResult;
  try {
    reports = await loadOrRegenerateReports(run);
  } catch (error) {
    throw new MobtraceCommandError(
      error instanceof Error
        ? `Could not generate report: ${error.message}`
        : "Could not generate report.",
      5,
    );
  }

  if (options.json === true) {
    io.stdout.write(`${JSON.stringify(reports.result)}\n`);
    return;
  }
  if (options.full === true) {
    io.stdout.write(reports.markdown);
    return;
  }
  io.stdout.write(reports.compact);
}
