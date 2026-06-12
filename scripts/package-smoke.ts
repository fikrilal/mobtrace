import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { runCommand, runNpm, type CommandResult } from "./process.ts";

interface PackageManifest {
  bin?: Record<string, string> | string;
  name: string;
  version: string;
}

export interface PackedFile {
  mode: number;
  path: string;
}

interface PackResult {
  filename: string;
  files: PackedFile[];
}

const EXPECTED_PACKAGE_FILES = new Set([
  "README.md",
  "dist/cli.d.ts",
  "dist/cli.js",
  "dist/cli.js.map",
  "package.json",
]);

function mobtraceBinPath(manifest: PackageManifest): string | undefined {
  if (typeof manifest.bin === "string") return manifest.bin;
  return manifest.bin?.mobtrace;
}

export function validatePackedFiles(
  manifest: PackageManifest,
  files: readonly PackedFile[],
): readonly string[] {
  const errors: string[] = [];
  const actualPaths = new Set(files.map((file) => file.path));

  for (const expectedPath of EXPECTED_PACKAGE_FILES) {
    if (!actualPaths.has(expectedPath)) {
      errors.push(`Package is missing expected file: ${expectedPath}`);
    }
  }
  for (const actualPath of actualPaths) {
    if (!EXPECTED_PACKAGE_FILES.has(actualPath)) {
      errors.push(`Package contains unexpected file: ${actualPath}`);
    }
  }

  const binPath = mobtraceBinPath(manifest);
  if (binPath === undefined) {
    errors.push("package.json does not declare the mobtrace executable");
    return errors;
  }

  const normalizedBinPath = binPath.replace(/^\.\//, "");
  const packedBin = files.find((file) => file.path === normalizedBinPath);
  if (packedBin === undefined) {
    errors.push(`Packaged CLI entry is missing: ${normalizedBinPath}`);
  } else if ((packedBin.mode & 0o111) === 0) {
    errors.push(`Packaged CLI entry is not executable: ${normalizedBinPath}`);
  }

  return errors;
}

async function invokeInstalledBin(
  installRoot: string,
  args: readonly string[],
): Promise<CommandResult> {
  const binDirectory = join(installRoot, "node_modules", ".bin");
  if (process.platform === "win32") {
    return await runCommand(
      "cmd.exe",
      ["/d", "/s", "/c", join(binDirectory, "mobtrace.cmd"), ...args],
      { cwd: installRoot },
    );
  }
  return await runCommand(join(binDirectory, "mobtrace"), args, {
    cwd: installRoot,
  });
}

export interface PackageSmokeOptions {
  build: boolean;
  packageRoot: string;
}

export async function verifyPackageSmoke(
  options: PackageSmokeOptions,
): Promise<void> {
  const packageRoot = resolve(options.packageRoot);
  const manifest = JSON.parse(
    await readFile(join(packageRoot, "package.json"), "utf8"),
  ) as PackageManifest;
  const packDirectory = await mkdtemp(join(tmpdir(), "mobtrace-pack-"));
  const installDirectory = await mkdtemp(join(tmpdir(), "mobtrace-install-"));

  try {
    if (options.build) {
      const build = await runNpm(["run", "build"], {
        cwd: packageRoot,
        inheritStdio: true,
      });
      if (build.exitCode !== 0) {
        throw new Error(
          `Package build failed with exit code ${build.exitCode}`,
        );
      }
    }

    const pack = await runNpm(
      ["pack", "--json", "--pack-destination", packDirectory],
      { cwd: packageRoot },
    );
    if (pack.exitCode !== 0) {
      throw new Error(`npm pack failed:\n${pack.stderr.trim()}`);
    }

    const packResults = JSON.parse(pack.stdout) as PackResult[];
    const packResult = packResults[0];
    if (packResult === undefined) {
      throw new Error("npm pack did not return package metadata");
    }

    const shapeErrors = validatePackedFiles(manifest, packResult.files);
    if (shapeErrors.length > 0) {
      throw new Error(
        `Package-content verification failed:\n- ${shapeErrors.join("\n- ")}`,
      );
    }

    await writeFile(
      join(installDirectory, "package.json"),
      JSON.stringify({ name: "mobtrace-smoke", private: true }),
      "utf8",
    );
    const tarballPath = join(packDirectory, basename(packResult.filename));
    const install = await runNpm(
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--offline",
        tarballPath,
      ],
      { cwd: installDirectory },
    );
    if (install.exitCode !== 0) {
      throw new Error(
        `Packed CLI installation failed:\n${install.stderr.trim()}`,
      );
    }

    const help = await invokeInstalledBin(installDirectory, ["--help"]);
    if (help.exitCode !== 0 || !help.stdout.includes("Usage: mobtrace")) {
      throw new Error(
        `Installed mobtrace --help failed:\n${help.stderr || help.stdout}`,
      );
    }

    const version = await invokeInstalledBin(installDirectory, ["--version"]);
    if (version.exitCode !== 0 || version.stdout.trim() !== manifest.version) {
      throw new Error(
        `Installed mobtrace --version returned "${version.stdout.trim()}", expected "${manifest.version}"`,
      );
    }
  } finally {
    await Promise.all([
      rm(packDirectory, { force: true, recursive: true }),
      rm(installDirectory, { force: true, recursive: true }),
    ]);
  }
}
