import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageSmoke } from "./package-smoke.ts";

interface CliOptions {
  build: boolean;
  packageRoot: string;
}

function parseArgs(args: readonly string[]): CliOptions {
  let build = true;
  let packageRoot = process.cwd();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--skip-build") {
      build = false;
      continue;
    }
    if (arg === "--package-root") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("--package-root requires a value");
      }
      packageRoot = resolve(value);
      index += 1;
      continue;
    }
    throw new Error(
      "Usage: node scripts/verify-package-smoke.ts [--package-root <path>] [--skip-build]",
    );
  }

  return { build, packageRoot };
}

export async function main(args: readonly string[]): Promise<void> {
  const options = parseArgs(args);
  await verifyPackageSmoke(options);
  process.stdout.write("Package smoke verification passed.\n");
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectExecution) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
