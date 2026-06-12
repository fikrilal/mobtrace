import { spawn } from "node:child_process";

import { Redactor, type RedactionOptions } from "./redaction.js";

export interface ProcessCommandSummary {
  readonly arguments: readonly string[];
  readonly executable: string;
}

export interface ProcessExecutionOptions {
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly executable: string;
  readonly killAfterMs?: number;
  readonly redaction?: RedactionOptions;
  readonly timeoutMs?: number;
}

export interface ProcessExecutionResult {
  readonly command: ProcessCommandSummary;
  readonly durationMs: number;
  readonly endedAt: string;
  readonly error: string | null;
  readonly exitCode: number | null;
  readonly rawCommand: ProcessCommandSummary;
  readonly redactedStderr: string;
  readonly redactedStdout: string;
  readonly signal: NodeJS.Signals | null;
  readonly startedAt: string;
  readonly status: "completed" | "failed-to-start" | "signaled" | "timed-out";
  readonly stderr: string;
  readonly stdout: string;
  readonly timedOut: boolean;
}

export async function executeProcess(
  options: ProcessExecutionOptions,
): Promise<ProcessExecutionResult> {
  const args = options.args ?? [];
  const redactor = new Redactor(options.redaction);
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  return await new Promise<ProcessExecutionResult>((resolve) => {
    let settled = false;
    let timedOut = false;
    let timeout: NodeJS.Timeout | undefined;
    let forceKillTimeout: NodeJS.Timeout | undefined;

    const child = spawn(options.executable, [...args], {
      cwd: options.cwd,
      detached: process.platform !== "win32",
      env: options.env ?? process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const finish = (partial: {
      readonly error: string | null;
      readonly exitCode: number | null;
      readonly signal: NodeJS.Signals | null;
    }): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceKillTimeout);

      const endedAtDate = new Date();
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      const rawCommand = {
        arguments: args,
        executable: options.executable,
      };

      resolve({
        command: {
          arguments: redactor.redactList(args),
          executable: redactor.redact(options.executable),
        },
        durationMs: Math.max(
          0,
          endedAtDate.getTime() - startedAtDate.getTime(),
        ),
        endedAt: endedAtDate.toISOString(),
        error: partial.error,
        exitCode: partial.exitCode,
        rawCommand,
        redactedStderr: redactor.redact(stderr),
        redactedStdout: redactor.redact(stdout),
        signal: partial.signal,
        startedAt,
        status: statusFor(partial.exitCode, partial.signal, timedOut),
        stderr,
        stdout,
        timedOut,
      });
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    child.on("error", (error) => {
      finish({
        error: error.message,
        exitCode: null,
        signal: null,
      });
    });

    child.on("close", (code, signal) => {
      finish({
        error: null,
        exitCode: code,
        signal,
      });
    });

    if (options.timeoutMs !== undefined) {
      timeout = setTimeout(() => {
        timedOut = true;
        killChild(child.pid, "SIGTERM");
        forceKillTimeout = setTimeout(() => {
          killChild(child.pid, "SIGKILL");
        }, options.killAfterMs ?? 1000);
      }, options.timeoutMs);
    }
  });
}

function killChild(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) {
    return;
  }

  if (process.platform === "win32") {
    process.kill(pid, signal);
    return;
  }

  process.kill(-pid, signal);
}

function statusFor(
  exitCode: number | null,
  signal: NodeJS.Signals | null,
  timedOut: boolean,
): ProcessExecutionResult["status"] {
  if (timedOut) {
    return "timed-out";
  }
  if (exitCode === null && signal === null) {
    return "failed-to-start";
  }
  if (signal !== null) {
    return "signaled";
  }
  return "completed";
}
