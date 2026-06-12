import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { executeProcess } from "../src/process/execute.js";
import { Redactor } from "../src/process/redaction.js";

const temporaryDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mobtrace-process-"));
  temporaryDirectories.push(root);
  return root;
}

async function createExecutable(
  root: string,
  name: string,
  body: string,
): Promise<string> {
  const path = join(root, name);
  await writeFile(path, `#!/usr/bin/env sh\n${body}\n`, "utf8");
  await chmod(path, 0o755);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await rm(path, { force: true, recursive: true });
    }),
  );
});

describe("process execution", () => {
  it("captures stdout and stderr separately", async () => {
    const root = await createTempDir();
    const executable = await createExecutable(
      root,
      "echo-streams",
      'printf "hello stdout\\n"\nprintf "hello stderr\\n" >&2',
    );

    const result = await executeProcess({ executable });

    expect(result.status).toBe("completed");
    expect(result.exitCode).toBe(0);
    expect(result.signal).toBeNull();
    expect(result.stdout).toBe("hello stdout\n");
    expect(result.stderr).toBe("hello stderr\n");
    expect(result.rawCommand.executable).toBe(executable);
    expect(result.command.executable).toBe(executable);
  });

  it("retains non-zero exit codes without throwing", async () => {
    const root = await createTempDir();
    const executable = await createExecutable(
      root,
      "fail",
      'printf "bad\\n" >&2\nexit 17',
    );

    const result = await executeProcess({ executable });

    expect(result.status).toBe("completed");
    expect(result.exitCode).toBe(17);
    expect(result.stderr).toBe("bad\n");
  });

  it("returns launch failures as structured results", async () => {
    const result = await executeProcess({
      executable: "/definitely/missing/mobtrace-command",
    });

    expect(result.status).toBe("failed-to-start");
    expect(result.exitCode).toBeNull();
    expect(result.signal).toBeNull();
    expect(result.error).toContain("ENOENT");
  });

  it("terminates processes after timeout", async () => {
    const root = await createTempDir();
    const executable = await createExecutable(root, "slow", "sleep 5");

    const result = await executeProcess({
      executable,
      killAfterMs: 10,
      timeoutMs: 20,
    });

    expect(result.status).toBe("timed-out");
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
    expect(result.signal).not.toBeNull();
  });

  it("records signal termination", async () => {
    const root = await createTempDir();
    const executable = await createExecutable(
      root,
      "self-signal",
      "kill -TERM $$\nsleep 1",
    );

    const result = await executeProcess({ executable });

    expect(result.status).toBe("signaled");
    expect(result.exitCode).toBeNull();
    expect(result.signal).toBe("SIGTERM");
  });

  it("redacts command summaries and stream display copies", async () => {
    const root = await createTempDir();
    const executable = await createExecutable(
      root,
      "secret",
      'printf "token=abc123\\n"\nprintf "bearer abc123\\n" >&2',
    );

    const result = await executeProcess({
      args: ["--password", "abc123"],
      executable,
      redaction: {
        patterns: [{ name: "bearer", regex: /bearer\s+[a-z0-9]+/giu }],
        values: ["abc123"],
      },
    });

    expect(result.rawCommand.arguments).toEqual(["--password", "abc123"]);
    expect(result.command.arguments).toEqual(["--password", "[REDACTED]"]);
    expect(result.stdout).toContain("abc123");
    expect(result.stderr).toContain("abc123");
    expect(result.redactedStdout).not.toContain("abc123");
    expect(result.redactedStderr).not.toContain("abc123");
    expect(result.redactedStderr).toContain("[REDACTED]");
  });
});

describe("redaction", () => {
  it("applies literal values before configured patterns", () => {
    const redactor = new Redactor({
      patterns: [{ name: "token", regex: /token=[^\s]+/gu }],
      values: ["secret"],
    });

    expect(redactor.redact("token=secret")).toBe("[REDACTED]");
  });
});
