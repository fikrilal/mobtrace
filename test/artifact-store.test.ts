import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ArtifactStoreError } from "../src/artifacts/errors.js";
import { ArtifactStore } from "../src/artifacts/store.js";
import { runManifestSchema } from "../src/contracts/report.js";

const temporaryDirectories: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mobtrace-artifacts-"));
  temporaryDirectories.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await rm(path, { force: true, recursive: true });
    }),
  );
});

describe("artifact store", () => {
  it("initializes a valid owner-only running manifest", async () => {
    const root = await temporaryRoot();
    const store = new ArtifactStore(root);

    const run = await store.initializeRun({
      deviceId: "emulator-5554",
      flowName: "login",
      flowPath: ".maestro/flows/login.yaml",
      flowResolution: "configured",
      now: new Date("2026-06-12T01:02:03.456Z"),
      randomBytes: () => Uint8Array.from([0x0a, 0x1b, 0xff]),
    });

    expect(run.manifest.runId).toBe("20260612T010203Z-0a1bff");
    expect(run.manifest.state).toBe("running");
    expect(
      runManifestSchema.parse(
        JSON.parse(await readFile(join(run.directory, "run.json"), "utf8")),
      ),
    ).toEqual(run.manifest);
    if (process.platform !== "win32") {
      expect((await stat(run.directory)).mode & 0o777).toBe(0o700);
      expect((await stat(join(run.directory, "run.json"))).mode & 0o777).toBe(
        0o600,
      );
    }
  });

  it("updates and completes the lifecycle manifest", async () => {
    const root = await temporaryRoot();
    const store = new ArtifactStore(root);
    const runId = "20260612T010203Z-0a1bff";
    await store.initializeRun({
      flowPath: ".maestro/flows/login.yaml",
      flowResolution: "path",
      now: new Date("2026-06-12T01:02:03.456Z"),
      runId,
    });

    const completed = await store.updateManifest(
      runId,
      {
        sourceControl: "git",
        state: "completed",
      },
      new Date("2026-06-12T01:03:00.000Z"),
    );

    expect(completed.state).toBe("completed");
    expect(completed.completedAt).toBe("2026-06-12T01:03:00.000Z");
    await expect(store.updateManifest(runId, {})).rejects.toMatchObject({
      code: "invalid-state-transition",
    });
  });

  it("can mark an interrupted run as partial", async () => {
    const root = await temporaryRoot();
    const store = new ArtifactStore(root);
    const runId = "20260612T010203Z-0a1bff";
    await store.initializeRun({
      flowPath: ".maestro/flows/login.yaml",
      flowResolution: "path",
      runId,
    });

    const partial = await store.updateManifest(
      runId,
      { state: "partial" },
      new Date("2026-06-12T01:03:00.000Z"),
    );

    expect(partial.state).toBe("partial");
    expect(partial.completedAt).toBe("2026-06-12T01:03:00.000Z");
  });

  it("refuses to overwrite an existing run", async () => {
    const root = await temporaryRoot();
    const store = new ArtifactStore(root);
    const input = {
      flowPath: ".maestro/flows/login.yaml",
      flowResolution: "path" as const,
      runId: "20260612T010203Z-0a1bff",
    };
    await store.initializeRun(input);

    await expect(store.initializeRun(input)).rejects.toMatchObject({
      code: "run-already-exists",
    });
  });

  it("does not create a run directory for an invalid manifest", async () => {
    const root = await temporaryRoot();
    const store = new ArtifactStore(root);
    const runId = "20260612T010203Z-0a1bff";

    await expect(
      store.initializeRun({
        flowPath: "../outside.yaml",
        flowResolution: "path",
        runId,
      }),
    ).rejects.toMatchObject({
      code: "invalid-manifest",
    });
    await expect(stat(join(root, runId))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("writes portable artifacts and preserves the previous file on failure", async () => {
    const root = await temporaryRoot();
    const store = new ArtifactStore(root);
    const runId = "20260612T010203Z-0a1bff";
    await store.initializeRun({
      flowPath: ".maestro/flows/login.yaml",
      flowResolution: "path",
      runId,
    });
    await store.writeJson(runId, "result.json", { status: "previous" });

    const circular: { self?: unknown } = {};
    circular.self = circular;
    await expect(
      store.writeJson(runId, "result.json", circular),
    ).rejects.toMatchObject({
      code: "write-failed",
    });

    expect(
      JSON.parse(
        await readFile(join(root, runId, "result.json"), "utf8"),
      ) as unknown,
    ).toEqual({ status: "previous" });

    await expect(
      store.writeJson(runId, "result.json", undefined),
    ).rejects.toMatchObject({
      code: "write-failed",
    });
  });

  it("reports a missing run with a typed error", async () => {
    const store = new ArtifactStore(await temporaryRoot());

    await expect(
      store.writeText("20260612T010203Z-0a1bff", "report.md", "content"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ArtifactStoreError>>({
        code: "run-not-found",
      }),
    );
  });

  it("reports malformed retained JSON as an invalid manifest", async () => {
    const root = await temporaryRoot();
    const store = new ArtifactStore(root);
    const runId = "20260612T010203Z-0a1bff";
    const runDirectory = join(root, runId);
    await store.initializeRun({
      flowPath: ".maestro/flows/login.yaml",
      flowResolution: "path",
      runId,
    });
    await rm(join(runDirectory, "run.json"));
    await writeFile(join(runDirectory, "run.json"), "{invalid", "utf8");

    await expect(store.readManifest(runId)).rejects.toMatchObject({
      code: "invalid-manifest",
    });
  });
});
