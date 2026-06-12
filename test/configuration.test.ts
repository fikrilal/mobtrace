import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ConfigurationError } from "../src/configuration/errors.js";
import {
  discoverConfiguration,
  loadConfiguration,
} from "../src/configuration/load.js";
import { resolveFlowInvocation } from "../src/configuration/resolve.js";

const temporaryDirectories: string[] = [];

async function createProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mobtrace-config-"));
  temporaryDirectories.push(root);
  return root;
}

async function writeConfig(root: string, content: string): Promise<void> {
  await writeFile(join(root, "mobtrace.yaml"), content, "utf8");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await rm(path, { force: true, recursive: true });
    }),
  );
});

describe("configuration loading", () => {
  it("loads a minimal named flow", async () => {
    const root = await createProject();
    await writeConfig(
      root,
      `version: 1
flows:
  login:
    path: .maestro/login.yaml
`,
    );

    const result = await loadConfiguration({ projectPath: root });

    expect(result.configuration.kind).toBe("project");
    expect(result.configuration.config?.flows?.login?.path).toBe(
      ".maestro/login.yaml",
    );
  });

  it.each([
    {
      config: `version: 1
unexpected: true
`,
      label: "unknown top-level field",
    },
    {
      config: `version: 1
defaults:
  timeout: 0s
`,
      label: "invalid duration",
    },
    {
      config: `version: 1
environment:
  MOBTRACE_TOKEN:
    value: secret
`,
      label: "reserved environment key",
    },
    {
      config: `version: 1
environment:
  PORT:
    value: 4000
`,
      label: "non-string literal environment value",
    },
    {
      config: `version: 1
diagnosis:
  redact:
    patterns:
      - name: broken
        regex: "["
`,
      label: "invalid redaction regex",
    },
  ])("rejects $label", async ({ config }) => {
    const root = await createProject();
    await writeConfig(root, config);

    await expect(
      loadConfiguration({ projectPath: root }),
    ).rejects.toBeInstanceOf(ConfigurationError);
  });

  it("treats missing project configuration as zero-configuration mode", async () => {
    const root = await createProject();

    const result = await discoverConfiguration(root);

    expect(result).toEqual({
      config: null,
      kind: "none",
      path: null,
    });
  });

  it("fails malformed YAML before command execution", async () => {
    const root = await createProject();
    await writeConfig(root, "version: 1\nflows:\n  login: [");

    await expect(
      loadConfiguration({ projectPath: root }),
    ).rejects.toBeInstanceOf(ConfigurationError);
  });
});

describe("flow resolution", () => {
  it("resolves a direct path without configuration", async () => {
    const root = await createProject();
    await mkdir(join(root, ".maestro"), { recursive: true });
    await writeFile(join(root, ".maestro/login.yaml"), "appId: test\n", "utf8");

    const discovery = await discoverConfiguration(root);
    const result = await resolveFlowInvocation(root, discovery, {
      flow: ".maestro/login.yaml",
    });

    expect(result.resolution).toBe("path");
    expect(result.flowName).toBeNull();
    expect(result.flowPathRelative).toBe(".maestro/login.yaml");
  });

  it("applies configured flow precedence and CLI overrides", async () => {
    const root = await createProject();
    await mkdir(join(root, ".maestro"), { recursive: true });
    await writeFile(join(root, ".maestro/login.yaml"), "appId: test\n", "utf8");
    await writeConfig(
      root,
      `version: 1
artifacts:
  root: .custom-runs
defaults:
  device: default-device
  baseline: origin/main
  timeout: 15m
maestro:
  executable: ./bin/maestro
environment:
  API_URL:
    value: http://127.0.0.1:4000
  PASSWORD:
    fromEnv: TEST_PASSWORD
flows:
  login:
    path: .maestro/login.yaml
    device: flow-device
    baseline: flow-base
    timeout: 30s
    owns:
      - lib/features/auth/
`,
    );

    const discovery = await discoverConfiguration(root);
    const result = await resolveFlowInvocation(root, discovery, {
      baseline: "cli-base",
      device: "cli-device",
      flow: "login",
      processEnv: { TEST_PASSWORD: "secret" },
    });

    expect(result.resolution).toBe("configured");
    expect(result.flowName).toBe("login");
    expect(result.device).toBe("cli-device");
    expect(result.baseline).toBe("cli-base");
    expect(result.timeout?.milliseconds).toBe(30_000);
    expect(result.artifactRoot).toBe(join(root, ".custom-runs"));
    expect(result.maestroExecutable).toBe(join(root, "bin/maestro"));
    expect(result.ownership).toEqual(["lib/features/auth/"]);
    expect(result.environment.get("API_URL")).toMatchObject({
      sensitive: false,
      value: "http://127.0.0.1:4000",
    });
    expect(result.environment.get("PASSWORD")).toMatchObject({
      sensitive: true,
      value: "secret",
    });
  });

  it("requires referenced environment variables when resolving a flow", async () => {
    const root = await createProject();
    await writeConfig(
      root,
      `version: 1
environment:
  PASSWORD:
    fromEnv: TEST_PASSWORD
flows:
  login:
    path: .maestro/login.yaml
`,
    );

    const discovery = await discoverConfiguration(root);

    await expect(
      resolveFlowInvocation(root, discovery, {
        flow: "login",
        processEnv: {},
      }),
    ).rejects.toBeInstanceOf(ConfigurationError);
  });

  it("chooses a configured flow when the same value is also a path", async () => {
    const root = await createProject();
    await mkdir(join(root, "login"), { recursive: true });
    await mkdir(join(root, ".maestro"), { recursive: true });
    await writeFile(join(root, ".maestro/login.yaml"), "appId: test\n", "utf8");
    await writeConfig(
      root,
      `version: 1
flows:
  login:
    path: .maestro/login.yaml
`,
    );

    const discovery = await discoverConfiguration(root);
    const result = await resolveFlowInvocation(root, discovery, {
      flow: "login",
    });

    expect(result.resolution).toBe("configured");
  });
});
