import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ArtifactStore } from "../src/artifacts/store.js";
import { executeHookLifecycle } from "../src/hooks/lifecycle.js";

const temporaryDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mobtrace-hooks-"));
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

async function createRun(root: string): Promise<{
  artifactsDir: string;
  store: ArtifactStore;
}> {
  const store = new ArtifactStore(join(root, ".mobtrace/runs"));
  const run = await store.initializeRun({
    flowName: "login",
    flowPath: ".maestro/login.yaml",
    flowResolution: "configured",
    runId: "20260612T000000Z-b00001",
  });
  return { artifactsDir: run.directory, store };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await rm(path, { force: true, recursive: true });
    }),
  );
});

describe("hook lifecycle", () => {
  it("runs preparation and cleanup hooks in lifecycle order", async () => {
    const root = await createTempDir();
    const { artifactsDir, store } = await createRun(root);
    const recorder = join(root, "order.txt");
    const projectPrepare = await createExecutable(
      root,
      "project-prepare",
      `printf "project-prepare\\n" >> "${recorder}"
printf '{"environment":{"FIXTURE_EMAIL":"run@example.test"}}' > "$MOBTRACE_HOOK_OUTPUT"`,
    );
    const flowPrepare = await createExecutable(
      root,
      "flow-prepare",
      `printf "flow-prepare:$FIXTURE_EMAIL\\n" >> "${recorder}"`,
    );
    const flowCleanup = await createExecutable(
      root,
      "flow-cleanup",
      `printf "flow-cleanup:$MOBTRACE_JOURNEY_STATUS\\n" >> "${recorder}"`,
    );
    const projectCleanup = await createExecutable(
      root,
      "project-cleanup",
      `printf "project-cleanup:$MOBTRACE_JOURNEY_STATUS\\n" >> "${recorder}"`,
    );

    const result = await executeHookLifecycle({
      artifactStore: store,
      artifactsDir,
      flowCleanup: { command: [flowCleanup] },
      flowName: "login",
      flowPath: ".maestro/login.yaml",
      flowPrepare: { command: [flowPrepare] },
      journeyAttempted: true,
      journeyStatus: "failed",
      projectCleanup: { command: [projectCleanup] },
      projectPrepare: { command: [projectPrepare] },
      projectRoot: root,
      runId: "20260612T000000Z-b00001",
    });

    expect(result.failed).toBe(false);
    expect(result.results.map((hook) => hook.id)).toEqual([
      "project-prepare",
      "flow-prepare",
      "flow-cleanup",
      "project-cleanup",
    ]);
    expect(result.exportedEnvironment.get("FIXTURE_EMAIL")).toBe(
      "run@example.test",
    );
    expect(await readFile(recorder, "utf8")).toBe(
      [
        "project-prepare",
        "flow-prepare:run@example.test",
        "flow-cleanup:failed",
        "project-cleanup:failed",
        "",
      ].join("\n"),
    );

    const hookResult = JSON.parse(
      await readFile(
        join(artifactsDir, "hooks/project-prepare/result.json"),
        "utf8",
      ),
    ) as { exportedEnvironmentKeys: string[]; status: string };
    expect(hookResult).toMatchObject({
      exportedEnvironmentKeys: ["FIXTURE_EMAIL"],
      status: "passed",
    });
  });

  it("runs cleanup for entered scopes after preparation failure", async () => {
    const root = await createTempDir();
    const { artifactsDir, store } = await createRun(root);
    const recorder = join(root, "order.txt");
    const projectPrepare = await createExecutable(
      root,
      "project-prepare",
      `printf "project-prepare\\n" >> "${recorder}"`,
    );
    const flowPrepare = await createExecutable(
      root,
      "flow-prepare",
      `printf "flow-prepare\\n" >> "${recorder}"
exit 12`,
    );
    const flowCleanup = await createExecutable(
      root,
      "flow-cleanup",
      `printf "flow-cleanup\\n" >> "${recorder}"`,
    );
    const projectCleanup = await createExecutable(
      root,
      "project-cleanup",
      `printf "project-cleanup\\n" >> "${recorder}"`,
    );

    const result = await executeHookLifecycle({
      artifactStore: store,
      artifactsDir,
      flowCleanup: { command: [flowCleanup] },
      flowName: "login",
      flowPath: ".maestro/login.yaml",
      flowPrepare: { command: [flowPrepare] },
      journeyAttempted: false,
      journeyStatus: "not-run",
      projectCleanup: { command: [projectCleanup] },
      projectPrepare: { command: [projectPrepare] },
      projectRoot: root,
      runId: "20260612T000000Z-b00001",
    });

    expect(result.failed).toBe(true);
    expect(result.results.map((hook) => hook.id)).toEqual([
      "project-prepare",
      "flow-prepare",
      "flow-cleanup",
      "project-cleanup",
    ]);
    expect(await readFile(recorder, "utf8")).toBe(
      [
        "project-prepare",
        "flow-prepare",
        "flow-cleanup",
        "project-cleanup",
        "",
      ].join("\n"),
    );
    const failedResult = JSON.parse(
      await readFile(
        join(artifactsDir, "hooks/flow-prepare/result.json"),
        "utf8",
      ),
    ) as { exitCode: number; status: string };
    expect(failedResult).toMatchObject({ exitCode: 12, status: "failed" });
  });

  it("does not persist exported environment values in hook result", async () => {
    const root = await createTempDir();
    const { artifactsDir, store } = await createRun(root);
    const projectPrepare = await createExecutable(
      root,
      "project-prepare",
      `printf '{"environment":{"SECRET_TOKEN":"super-secret"}}' > "$MOBTRACE_HOOK_OUTPUT"`,
    );

    await executeHookLifecycle({
      artifactStore: store,
      artifactsDir,
      flowName: "login",
      flowPath: ".maestro/login.yaml",
      journeyAttempted: false,
      journeyStatus: "not-run",
      projectPrepare: { command: [projectPrepare] },
      projectRoot: root,
      runId: "20260612T000000Z-b00001",
    });

    const resultJson = await readFile(
      join(artifactsDir, "hooks/project-prepare/result.json"),
      "utf8",
    );

    expect(resultJson).toContain("SECRET_TOKEN");
    expect(resultJson).not.toContain("super-secret");
  });
});
