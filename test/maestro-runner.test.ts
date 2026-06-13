import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ArtifactStore } from "../src/artifacts/store.js";
import { discoverConfiguration } from "../src/configuration/load.js";
import { resolveFlowInvocation } from "../src/configuration/resolve.js";
import { MaestroRunner } from "../src/runner/maestro.js";

const temporaryDirectories: string[] = [];

async function createProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mobtrace-maestro-"));
  temporaryDirectories.push(root);
  await mkdir(join(root, ".maestro"), { recursive: true });
  await writeFile(join(root, ".maestro/login.yaml"), "appId: test\n", "utf8");
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

describe("Maestro runner", () => {
  it("runs a passing flow and retains runner evidence", async () => {
    const root = await createProject();
    const maestro = await createExecutable(
      root,
      "maestro",
      `if [ "$1" = "--version" ]; then
  printf "maestro 2.test\\n"
  exit 0
fi
printf "stdout:$*\\n"
printf "stderr:$MOBTRACE_TEST_VALUE\\n" >&2
exit 0`,
    );
    await writeFile(
      join(root, "mobtrace.yaml"),
      `version: 1
maestro:
  executable: ${maestro}
flows:
  login:
    path: .maestro/login.yaml
    device: emulator-5554
`,
      "utf8",
    );
    const store = new ArtifactStore(join(root, ".mobtrace/runs"));
    const run = await store.initializeRun({
      flowName: "login",
      flowPath: ".maestro/login.yaml",
      flowResolution: "configured",
      runId: "20260612T000000Z-c00001",
    });
    const flow = await resolveFlowInvocation(
      root,
      await discoverConfiguration(root),
      { flow: "login" },
    );

    const result = await new MaestroRunner().run({
      artifactStore: store,
      environment: new Map([["MOBTRACE_TEST_VALUE", "from-env"]]),
      flow,
      projectRoot: root,
      runDirectory: run.directory,
      runId: run.manifest.runId,
    });

    expect(result.status).toBe("passed");
    expect(result.exitCode).toBe(0);
    expect(result.command?.arguments).toEqual([
      "test",
      "--device",
      "emulator-5554",
      "-e",
      "MOBTRACE_TEST_VALUE=from-env",
      flow.flowPath,
    ]);
    expect(
      await readFile(join(run.directory, "runner/stdout.log"), "utf8"),
    ).toContain(
      "stdout:test --device emulator-5554 -e MOBTRACE_TEST_VALUE=from-env",
    );
    expect(
      await readFile(join(run.directory, "runner/stderr.log"), "utf8"),
    ).toBe("stderr:from-env\n");
    const runnerResult = JSON.parse(
      await readFile(join(run.directory, "runner/result.json"), "utf8"),
    ) as { runnerVersion: string; status: string };
    expect(runnerResult).toMatchObject({
      runnerVersion: "maestro 2.test",
      status: "passed",
    });
  });

  it("passes configured environment through Maestro -e arguments", async () => {
    const root = await createProject();
    const maestro = await createExecutable(
      root,
      "maestro",
      `if [ "$1" = "--version" ]; then exit 0; fi
printf "%s\\n" "$*"`,
    );
    await writeFile(
      join(root, "mobtrace.yaml"),
      `version: 1
maestro:
  executable: ${maestro}
flows:
  login:
    path: .maestro/login.yaml
`,
      "utf8",
    );
    const store = new ArtifactStore(join(root, ".mobtrace/runs"));
    const run = await store.initializeRun({
      flowName: "login",
      flowPath: ".maestro/login.yaml",
      flowResolution: "configured",
      runId: "20260612T000000Z-c00004",
    });
    const flow = await resolveFlowInvocation(
      root,
      await discoverConfiguration(root),
      { flow: "login" },
    );

    const result = await new MaestroRunner().run({
      artifactStore: store,
      environment: new Map([
        ["APP_ID", "dev.example"],
        ["MAESTRO_TEST_PASSWORD", "secret-password"],
      ]),
      flow,
      projectRoot: root,
      redactionValues: ["secret-password"],
      runDirectory: run.directory,
      runId: run.manifest.runId,
    });

    expect(result.status).toBe("passed");
    expect(result.command?.arguments).toEqual([
      "test",
      "-e",
      "APP_ID=dev.example",
      "-e",
      "MAESTRO_TEST_PASSWORD=[REDACTED]",
      flow.flowPath,
    ]);
    expect(
      await readFile(join(run.directory, "runner/stdout.log"), "utf8"),
    ).toContain("MAESTRO_TEST_PASSWORD=[REDACTED]");
  });

  it("maps non-zero Maestro exit to failed journey", async () => {
    const root = await createProject();
    const maestro = await createExecutable(
      root,
      "maestro",
      `if [ "$1" = "--version" ]; then exit 0; fi
printf "failed\\n" >&2
exit 42`,
    );
    await writeFile(
      join(root, "mobtrace.yaml"),
      `version: 1
maestro:
  executable: ${maestro}
flows:
  login:
    path: .maestro/login.yaml
`,
      "utf8",
    );
    const store = new ArtifactStore(join(root, ".mobtrace/runs"));
    const run = await store.initializeRun({
      flowName: "login",
      flowPath: ".maestro/login.yaml",
      flowResolution: "configured",
      runId: "20260612T000000Z-c00002",
    });
    const flow = await resolveFlowInvocation(
      root,
      await discoverConfiguration(root),
      { flow: "login" },
    );

    const result = await new MaestroRunner().run({
      artifactStore: store,
      environment: new Map(),
      flow,
      projectRoot: root,
      runDirectory: run.directory,
      runId: run.manifest.runId,
    });

    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(42);
    expect(result.error).toMatchObject({ code: "runner-exit-nonzero" });
  });

  it("maps Maestro timeout to failed journey", async () => {
    const root = await createProject();
    const maestro = await createExecutable(
      root,
      "maestro",
      `if [ "$1" = "--version" ]; then exit 0; fi
sleep 5`,
    );
    await writeFile(
      join(root, "mobtrace.yaml"),
      `version: 1
maestro:
  executable: ${maestro}
flows:
  login:
    path: .maestro/login.yaml
    timeout: 20ms
`,
      "utf8",
    );
    const store = new ArtifactStore(join(root, ".mobtrace/runs"));
    const run = await store.initializeRun({
      flowName: "login",
      flowPath: ".maestro/login.yaml",
      flowResolution: "configured",
      runId: "20260612T000000Z-c00003",
    });
    const flow = await resolveFlowInvocation(
      root,
      await discoverConfiguration(root),
      { flow: "login" },
    );

    const result = await new MaestroRunner().run({
      artifactStore: store,
      environment: new Map(),
      flow,
      projectRoot: root,
      runDirectory: run.directory,
      runId: run.manifest.runId,
    });

    expect(result.status).toBe("failed");
    expect(result.timedOut).toBe(true);
    expect(result.error).toMatchObject({ code: "runner-timeout" });
  });
});
