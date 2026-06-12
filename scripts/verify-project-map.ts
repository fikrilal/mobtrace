import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkProjectMap } from "./project-map.ts";

function parseRoot(args: readonly string[]): string {
  if (args.length === 0) return process.cwd();
  if (args.length === 2 && args[0] === "--root" && args[1] !== undefined) {
    return resolve(args[1]);
  }
  throw new Error("Usage: node scripts/verify-project-map.ts [--root <path>]");
}

export async function main(args: readonly string[]): Promise<void> {
  const root = parseRoot(args);
  const result = await checkProjectMap(root);

  if (result.errors.length > 0) {
    throw new Error(
      `Project-map verification failed:\n- ${result.errors.join("\n- ")}`,
    );
  }

  process.stdout.write(
    [
      "Project-map verification passed",
      `- Markdown files: ${result.checkedMarkdownFiles}`,
      `- References: ${result.checkedReferences}`,
      "",
    ].join("\n"),
  );
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
