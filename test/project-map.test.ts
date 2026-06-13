import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { checkProjectMap } from "../scripts/project-map.ts";

const temporaryDirectories: string[] = [];

async function createMinimalProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mobtrace-project-map-"));
  temporaryDirectories.push(root);

  const requiredFiles = [
    "AGENTS.md",
    "README.md",
    "_WIP/README.md",
    "docs/README.md",
    "docs/product/product.md",
    "docs/contracts/cli.md",
    "docs/contracts/configuration.md",
    "docs/contracts/report.md",
    "docs/engineering/architecture.md",
    "docs/engineering/agent-loop.md",
    "docs/engineering/guardrails.md",
    "docs/engineering/harness-proposal.md",
    "docs/engineering/implementation-plan.md",
    "docs/engineering/parallel-agent-workflow.md",
    "docs/engineering/platform-support.md",
    "docs/engineering/proposal.md",
    "docs/engineering/tech-stack.md",
    "docs/engineering/testing-strategy.md",
    "docs/exec-plans/README.md",
    "docs/exec-plans/_template.md",
    "docs/exec-plans/tech-debt-tracker.md",
    "docs/adr/README.md",
    "docs/adr/template.md",
  ];

  for (const file of requiredFiles) {
    await mkdir(join(root, file, ".."), { recursive: true });
    await writeFile(join(root, file), "# Fixture\n", "utf8");
  }
  await mkdir(join(root, "docs/exec-plans/active"), { recursive: true });
  await mkdir(join(root, "docs/exec-plans/completed"), { recursive: true });
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "test"), { recursive: true });

  const index = requiredFiles
    .filter((path) => path.startsWith("docs/") && path !== "docs/README.md")
    .map((path) => `- \`${path}\``)
    .join("\n");
  await writeFile(join(root, "docs/README.md"), `${index}\n`, "utf8");
  await writeFile(
    join(root, "docs/engineering/architecture.md"),
    "```text\nsrc/\ntest/\n```\n",
    "utf8",
  );
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ scripts: { verify: "echo ok" } }),
    "utf8",
  );

  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await rm(path, { force: true, recursive: true });
    }),
  );
});

describe("project-map verification", () => {
  it("accepts a complete knowledge map", async () => {
    const root = await createMinimalProject();

    const result = await checkProjectMap(root);

    expect(result.errors).toEqual([]);
  });

  it("reports a missing indexed contract", async () => {
    const root = await createMinimalProject();
    await rm(join(root, "docs/contracts/cli.md"));

    const result = await checkProjectMap(root);

    expect(result.errors).toContain(
      "Missing required path: docs/contracts/cli.md",
    );
    expect(result.errors).toContain(
      "docs/README.md references missing path: docs/contracts/cli.md",
    );
  });

  it("reports undocumented npm commands", async () => {
    const root = await createMinimalProject();
    await writeFile(
      join(root, "README.md"),
      "Run `npm run missing-command`.\n",
      "utf8",
    );

    const result = await checkProjectMap(root);

    expect(result.errors).toContain(
      "README.md references missing npm script: npm run missing-command",
    );
  });
});
