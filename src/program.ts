import { Command } from "commander";

import { MobtraceCommandError } from "./cli-error.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runInitCommand } from "./commands/init.js";
import type { CommandIo } from "./commands/io.js";
import { runReportCommand } from "./commands/report.js";
import { runVerifyCommand } from "./commands/verify.js";
import { MOBTRACE_VERSION } from "./version.js";

export interface ProgramOptions {
  readonly stderr?: CommandIo["stderr"];
  readonly stdout?: CommandIo["stdout"];
}

export function createProgram(options: ProgramOptions = {}): Command {
  const io: CommandIo = {
    stderr: options.stderr ?? process.stderr,
    stdout: options.stdout ?? process.stdout,
  };

  const program = new Command()
    .name("mobtrace")
    .description(
      "Diff-aware mobile regression evidence and diagnosis for coding agents.",
    )
    .version(MOBTRACE_VERSION)
    .option(
      "--project <path>",
      "Project root. Defaults to the current working directory.",
    )
    .option("--config <path>", "Explicit configuration file.")
    .option("--no-color", "Disable terminal colors.")
    .option("--quiet", "Suppress progress output.")
    .option("--verbose", "Print detailed MobTrace diagnostic output.")
    .hook("preAction", (command) => {
      const globalOptions = command.opts();
      if (globalOptions.quiet === true && globalOptions.verbose === true) {
        throw new MobtraceCommandError(
          "--quiet and --verbose are mutually exclusive.",
          2,
        );
      }
    });

  program
    .command("init")
    .description("Create a starter MobTrace configuration.")
    .option("--force", "Replace an existing MobTrace configuration.")
    .action(async (commandOptions: { force?: boolean }) => {
      const globalOptions = program.opts<{
        config?: string;
        project?: string;
      }>();

      await runInitCommand(
        {
          config: globalOptions.config,
          force: commandOptions.force,
          project: globalOptions.project,
        },
        io,
      );
    });

  program
    .command("doctor")
    .description("Validate local MobTrace project readiness.")
    .option("--device <id>", "Validate a specific device.")
    .option("--json", "Print only a machine-readable result.")
    .action(async (commandOptions: { device?: string; json?: boolean }) => {
      const globalOptions = program.opts<{
        config?: string;
        project?: string;
      }>();

      await runDoctorCommand(
        {
          config: globalOptions.config,
          device: commandOptions.device,
          json: commandOptions.json,
          project: globalOptions.project,
        },
        io,
      );
    });

  program
    .command("verify")
    .description("Run one mobile journey and retain evidence.")
    .requiredOption(
      "--flow <flow>",
      "Configured flow name or Maestro flow path.",
    )
    .option("--device <id>", "Target device identifier.")
    .option(
      "--baseline <git-ref>",
      "Source revision used for change comparison.",
    )
    .option("--artifacts <path>", "Artifact root for this invocation.")
    .option("--json", "Print only the final machine-readable result.")
    .action(
      async (commandOptions: {
        artifacts?: string;
        baseline?: string;
        device?: string;
        flow: string;
        json?: boolean;
      }) => {
        const globalOptions = program.opts<{
          config?: string;
          project?: string;
        }>();

        await runVerifyCommand(
          {
            artifacts: commandOptions.artifacts,
            baseline: commandOptions.baseline,
            config: globalOptions.config,
            device: commandOptions.device,
            flow: commandOptions.flow,
            json: commandOptions.json,
            project: globalOptions.project,
          },
          io,
        );
      },
    );

  program
    .command("report")
    .description("Read or regenerate a retained MobTrace report.")
    .argument(
      "[run]",
      "Run identifier, artifact directory, or latest.",
      "latest",
    )
    .option("--json", "Print only the machine-readable result.")
    .option("--full", "Print the full Markdown report.")
    .action(
      async (
        run: string,
        commandOptions: { full?: boolean; json?: boolean },
      ) => {
        const globalOptions = program.opts<{
          config?: string;
          project?: string;
        }>();

        await runReportCommand(
          {
            config: globalOptions.config,
            full: commandOptions.full,
            json: commandOptions.json,
            project: globalOptions.project,
            run,
          },
          io,
        );
      },
    );

  return program;
}
