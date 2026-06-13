import { spawn } from "node:child_process";

import { Redactor, type RedactionOptions } from "./redaction.js";

export interface ProcessCommandSummary {
  readonly arguments: readonly string[];
  readonly executable: string;
}

export interface ProcessExecutionOptions {
  readonly abortSignal?: AbortSignal;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly executable: string;
  readonly killAfterMs?: number;
  readonly maxOutputBytes?: number;
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
  readonly status:
    | "completed"
    | "failed-to-start"
    | "interrupted"
    | "signaled"
    | "timed-out";
  readonly stderr: string;
  readonly stderrBytes: number;
  readonly stderrTruncated: boolean;
  readonly stdout: string;
  readonly stdoutBytes: number;
  readonly stdoutTruncated: boolean;
  readonly timedOut: boolean;
  readonly interrupted: boolean;
}

const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

export async function executeProcess(
  options: ProcessExecutionOptions,
): Promise<ProcessExecutionResult> {
  const args = options.args ?? [];
  const redactor = new Redactor(options.redaction);
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1) {
    throw new Error("maxOutputBytes must be a positive safe integer.");
  }
  const stdoutCapture = new BoundedOutput(maxOutputBytes);
  const stderrCapture = new BoundedOutput(maxOutputBytes);

  return await new Promise<ProcessExecutionResult>((resolve) => {
    let settled = false;
    let interrupted = false;
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
      options.abortSignal?.removeEventListener("abort", interrupt);

      const endedAtDate = new Date();
      const stdout = stdoutCapture.toString();
      const stderr = stderrCapture.toString();
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
        status: statusFor(
          partial.exitCode,
          partial.signal,
          timedOut,
          interrupted,
        ),
        stderr,
        stderrBytes: stderrCapture.totalBytes,
        stderrTruncated: stderrCapture.truncated,
        stdout,
        stdoutBytes: stdoutCapture.totalBytes,
        stdoutTruncated: stdoutCapture.truncated,
        timedOut,
        interrupted,
      });
    };

    const interrupt = (): void => {
      interrupted = true;
      killChild(child.pid, "SIGTERM");
      forceKillTimeout = setTimeout(() => {
        killChild(child.pid, "SIGKILL");
      }, options.killAfterMs ?? 1000);
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutCapture.append(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrCapture.append(chunk);
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

    options.abortSignal?.addEventListener("abort", interrupt, { once: true });
    if (options.abortSignal?.aborted === true) {
      interrupt();
    }

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

class BoundedOutput {
  readonly #headLimit: number;
  readonly #limit: number;
  readonly #tailLimit: number;
  #complete: Buffer[] | null = [];
  #head: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  #retainedBytes = 0;
  #tail: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  #totalBytes = 0;

  constructor(limit: number) {
    this.#limit = limit;
    this.#headLimit = Math.ceil(limit / 2);
    this.#tailLimit = Math.floor(limit / 2);
  }

  get totalBytes(): number {
    return this.#totalBytes;
  }

  get truncated(): boolean {
    return this.#totalBytes > this.#limit;
  }

  append(chunk: Buffer): void {
    this.#totalBytes += chunk.length;
    if (this.#complete !== null) {
      this.#complete.push(chunk);
      this.#retainedBytes += chunk.length;
      if (this.#retainedBytes <= this.#limit) {
        return;
      }

      const complete = Buffer.concat(this.#complete);
      this.#head = complete.subarray(0, this.#headLimit);
      this.#tail =
        this.#tailLimit === 0
          ? Buffer.alloc(0)
          : complete.subarray(-this.#tailLimit);
      this.#complete = null;
      return;
    }

    if (this.#tailLimit === 0) {
      return;
    }
    this.#tail =
      chunk.length >= this.#tailLimit
        ? chunk.subarray(-this.#tailLimit)
        : Buffer.concat([this.#tail, chunk]).subarray(-this.#tailLimit);
  }

  toString(): string {
    if (this.#complete !== null) {
      return Buffer.concat(this.#complete).toString("utf8");
    }

    const marker = Buffer.from(
      `\n[MOBTRACE OUTPUT TRUNCATED: retained ${this.#limit} of ${this.#totalBytes} bytes]\n`,
      "utf8",
    );
    return Buffer.concat([this.#head, marker, this.#tail]).toString("utf8");
  }
}

function killChild(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) {
    return;
  }

  try {
    if (process.platform === "win32") {
      process.kill(pid, signal);
      return;
    }

    process.kill(-pid, signal);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ESRCH") {
      throw error;
    }
  }
}

function statusFor(
  exitCode: number | null,
  signal: NodeJS.Signals | null,
  timedOut: boolean,
  interrupted: boolean,
): ProcessExecutionResult["status"] {
  if (interrupted) {
    return "interrupted";
  }
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
