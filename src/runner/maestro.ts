import type {
  JourneyExecutionInput,
  JourneyExecutionResult,
  JourneyRunner,
} from "../verify/lifecycle.js";
import { executeProcess } from "../process/execute.js";

export class MaestroRunner implements JourneyRunner {
  async run(input: JourneyExecutionInput): Promise<JourneyExecutionResult> {
    const version = await detectVersion(
      input.flow.maestroExecutable,
      input.projectRoot,
      input.abortSignal,
    );
    const args = buildMaestroArgs(input);
    const result = await executeProcess({
      ...(input.abortSignal === undefined
        ? {}
        : { abortSignal: input.abortSignal }),
      args,
      cwd: input.projectRoot,
      env: {
        ...process.env,
        ...Object.fromEntries(input.environment),
      },
      executable: input.flow.maestroExecutable,
      ...(input.flow.timeout === undefined
        ? {}
        : { timeoutMs: input.flow.timeout.milliseconds }),
    });

    const stdoutPath = await input.artifactStore.writeText(
      input.runId,
      "runner/stdout.log",
      result.stdout,
    );
    const stderrPath = await input.artifactStore.writeText(
      input.runId,
      "runner/stderr.log",
      result.stderr,
    );
    const status = result.interrupted
      ? "interrupted"
      : result.exitCode === 0 && !result.timedOut
        ? "passed"
        : "failed";
    const output = {
      schemaVersion: 1,
      command: result.command,
      durationMs: result.durationMs,
      endedAt: result.endedAt,
      exitCode: result.exitCode,
      maestro: {},
      runner: "maestro",
      runnerVersion: version,
      startedAt: result.startedAt,
      status,
      stderr: stderrPath,
      stderrBytes: result.stderrBytes,
      stderrTruncated: result.stderrTruncated,
      stdout: stdoutPath,
      stdoutBytes: result.stdoutBytes,
      stdoutTruncated: result.stdoutTruncated,
      timedOut: result.timedOut,
    };
    const resultPath = await input.artifactStore.writeJson(
      input.runId,
      "runner/result.json",
      output,
    );

    return {
      command: result.command,
      durationMs: result.durationMs,
      endedAt: result.endedAt,
      error:
        status === "passed"
          ? null
          : {
              code: result.interrupted
                ? "runner-interrupted"
                : result.timedOut
                  ? "runner-timeout"
                  : "runner-exit-nonzero",
              message: result.interrupted
                ? "Maestro was interrupted."
                : result.timedOut
                  ? "Maestro timed out."
                  : "Maestro reported a failed journey.",
            },
      exitCode: result.exitCode,
      result: resultPath,
      startedAt: result.startedAt,
      status,
      stderr: stderrPath,
      stdout: stdoutPath,
      timedOut: result.timedOut,
    };
  }
}

function buildMaestroArgs(input: JourneyExecutionInput): readonly string[] {
  const args = [];
  if (input.flow.device !== undefined) {
    args.push("--device", input.flow.device);
  }
  args.push("test", input.flow.flowPath);
  return args;
}

async function detectVersion(
  executable: string,
  projectRoot: string,
  abortSignal?: AbortSignal,
): Promise<string | null> {
  const result = await executeProcess({
    ...(abortSignal === undefined ? {} : { abortSignal }),
    args: ["--version"],
    cwd: projectRoot,
    executable,
    timeoutMs: 5000,
  });

  if (result.exitCode !== 0) {
    return null;
  }

  const version = result.stdout.trim() || result.stderr.trim();
  return version.length === 0 ? null : version;
}
