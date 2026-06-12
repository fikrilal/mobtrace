import { spawn } from "node:child_process";

export interface CommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  inheritStdio?: boolean;
}

export async function runCommand(
  command: string,
  args: readonly string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  return await new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, [...args], {
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      env: options.env ?? process.env,
      shell: false,
      stdio: options.inheritStdio ? "inherit" : ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    let stdout = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`${command} exited with signal ${signal}`));
        return;
      }
      resolve({ exitCode: code ?? 1, stderr, stdout });
    });
  });
}

export async function runNpm(
  args: readonly string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  if (process.platform === "win32") {
    return await runCommand(
      "cmd.exe",
      ["/d", "/s", "/c", "npm", ...args],
      options,
    );
  }
  return await runCommand("npm", args, options);
}
