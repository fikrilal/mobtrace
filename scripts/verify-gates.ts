import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand, runNpm, type CommandResult } from "./process.ts";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function assertExpectedFailure(
  gate: string,
  result: CommandResult,
  expectedMarker: string,
): void {
  if (result.exitCode === 0) {
    throw new Error(`${gate} unexpectedly passed; the gate may be ineffective`);
  }

  const output = `${result.stdout}\n${result.stderr}`;
  if (!output.includes(expectedMarker)) {
    throw new Error(
      `${gate} failed without expected marker "${expectedMarker}":\n${output}`,
    );
  }
}

async function verifyProjectMapHonesty(): Promise<void> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "mobtrace-map-honesty-"));
  try {
    for (const path of [
      "AGENTS.md",
      "README.md",
      "_WIP",
      "docs",
      "package.json",
      "src",
      "test",
    ]) {
      await cp(resolve(repositoryRoot, path), join(fixtureRoot, path), {
        recursive: true,
      });
    }
    await rm(join(fixtureRoot, "docs/contracts/cli.md"));

    const result = await runCommand(
      process.execPath,
      [
        resolve(repositoryRoot, "scripts/verify-project-map.ts"),
        "--root",
        fixtureRoot,
      ],
      { cwd: repositoryRoot },
    );
    assertExpectedFailure(
      "verify:project-map",
      result,
      "Missing required path: docs/contracts/cli.md",
    );
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
}

async function verifyPackageHonesty(): Promise<void> {
  const fixtureRoot = await mkdtemp(
    join(tmpdir(), "mobtrace-package-honesty-"),
  );
  try {
    await mkdir(join(fixtureRoot, "dist"), { recursive: true });
    await writeFile(
      join(fixtureRoot, "README.md"),
      "# Broken package\n",
      "utf8",
    );
    await writeFile(join(fixtureRoot, "dist/cli.d.ts"), "export {};\n", "utf8");
    await writeFile(join(fixtureRoot, "dist/cli.js.map"), "{}\n", "utf8");
    await writeFile(
      join(fixtureRoot, "package.json"),
      JSON.stringify({
        bin: { mobtrace: "./dist/cli.js" },
        files: ["dist", "README.md"],
        name: "mobtrace-honesty-fixture",
        type: "module",
        version: "0.0.0",
      }),
      "utf8",
    );

    const result = await runCommand(
      process.execPath,
      [
        resolve(repositoryRoot, "scripts/verify-package-smoke.ts"),
        "--package-root",
        fixtureRoot,
        "--skip-build",
      ],
      { cwd: repositoryRoot },
    );
    assertExpectedFailure(
      "verify:package",
      result,
      "Packaged CLI entry is missing: dist/cli.js",
    );
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
}

async function verifyTypecheckHonesty(): Promise<void> {
  const fixtureRoot = await mkdtemp(
    join(tmpdir(), "mobtrace-typecheck-honesty-"),
  );
  try {
    await writeFile(
      join(fixtureRoot, "invalid.ts"),
      [
        "const gateHonestyValue: string = 42;",
        "export { gateHonestyValue };",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(fixtureRoot, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { types: [] },
        extends: resolve(repositoryRoot, "tsconfig.json"),
        files: ["invalid.ts"],
        include: [],
      }),
      "utf8",
    );

    const result = await runNpm(
      [
        "run",
        "typecheck",
        "--",
        "--project",
        join(fixtureRoot, "tsconfig.json"),
      ],
      { cwd: repositoryRoot },
    );
    assertExpectedFailure("typecheck", result, "TS2322");
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
}

export async function main(): Promise<void> {
  const checks = [
    ["Project-map gate honesty", verifyProjectMapHonesty],
    ["Package gate honesty", verifyPackageHonesty],
    ["Type-check gate honesty", verifyTypecheckHonesty],
  ] as const;

  for (const [title, check] of checks) {
    process.stdout.write(`==> ${title}\n`);
    await check();
  }

  process.stdout.write("Gate-honesty verification passed.\n");
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectExecution) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
