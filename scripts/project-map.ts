import { access, readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

interface PackageManifest {
  scripts?: Record<string, string>;
}

export interface ProjectMapResult {
  checkedMarkdownFiles: number;
  checkedReferences: number;
  errors: readonly string[];
}

const REQUIRED_PATHS = [
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
  "docs/engineering/proposal.md",
  "docs/engineering/tech-stack.md",
  "docs/engineering/testing-strategy.md",
  "docs/exec-plans/README.md",
  "docs/exec-plans/_template.md",
  "docs/exec-plans/active",
  "docs/exec-plans/completed",
  "docs/exec-plans/tech-debt-tracker.md",
  "docs/adr/README.md",
  "docs/adr/template.md",
  "src",
  "test",
] as const;

const INDEXED_PATHS = [
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
  "docs/engineering/proposal.md",
  "docs/engineering/tech-stack.md",
  "docs/engineering/testing-strategy.md",
  "docs/exec-plans/README.md",
  "docs/exec-plans/_template.md",
  "docs/exec-plans/tech-debt-tracker.md",
  "docs/adr/README.md",
  "docs/adr/template.md",
] as const;

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listMarkdownFiles(root: string): Promise<readonly string[]> {
  const files: string[] = [];

  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if ([".git", "dist", "node_modules"].includes(entry.name)) {
        continue;
      }
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(path);
      }
    }
  }

  await walk(root);
  return files.sort((left, right) => left.localeCompare(right));
}

function referencedRepositoryPaths(markdown: string): readonly string[] {
  const references = new Set<string>();
  const pattern = /`((?:docs|_WIP|src|test)\/[^`\n]+)`/g;

  for (const match of markdown.matchAll(pattern)) {
    const value = match[1]?.replace(/[,.;:]$/, "");
    if (
      value === undefined ||
      value.includes("...") ||
      value.includes("<") ||
      value.includes("YYYY-")
    ) {
      continue;
    }
    references.add(value);
  }

  return [...references];
}

function referencedNpmScripts(markdown: string): readonly string[] {
  const scripts = new Set<string>();
  for (const match of markdown.matchAll(/\bnpm run ([A-Za-z0-9:_-]+)/g)) {
    const script = match[1];
    if (script !== undefined) scripts.add(script);
  }
  return [...scripts];
}

async function sourceDirectories(root: string): Promise<readonly string[]> {
  const directories: string[] = [];
  for (const base of ["src", "test"]) {
    const basePath = resolve(root, base);
    if (!(await exists(basePath))) continue;
    directories.push(`${base}/`);
    for (const entry of await readdir(basePath, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        directories.push(`${base}/${entry.name}/`);
      }
    }
  }
  return directories.sort((left, right) => left.localeCompare(right));
}

export async function checkProjectMap(root: string): Promise<ProjectMapResult> {
  const resolvedRoot = resolve(root);
  const errors: string[] = [];

  for (const requiredPath of REQUIRED_PATHS) {
    if (!(await exists(resolve(resolvedRoot, requiredPath)))) {
      errors.push(`Missing required path: ${requiredPath}`);
    }
  }

  const docsIndexPath = resolve(resolvedRoot, "docs/README.md");
  const docsIndex = (await exists(docsIndexPath))
    ? await readFile(docsIndexPath, "utf8")
    : "";
  for (const indexedPath of INDEXED_PATHS) {
    if (!docsIndex.includes(`\`${indexedPath}\``)) {
      errors.push(`Documentation index is missing: ${indexedPath}`);
    }
  }

  const packagePath = resolve(resolvedRoot, "package.json");
  let packageScripts: Readonly<Record<string, string>> = {};
  if (await exists(packagePath)) {
    const manifest = JSON.parse(
      await readFile(packagePath, "utf8"),
    ) as PackageManifest;
    packageScripts = manifest.scripts ?? {};
  } else {
    errors.push("Missing required path: package.json");
  }

  const markdownFiles = await listMarkdownFiles(resolvedRoot);
  let checkedReferences = 0;
  for (const markdownFile of markdownFiles) {
    const markdown = await readFile(markdownFile, "utf8");
    const relativeFile = normalizePath(relative(resolvedRoot, markdownFile));

    for (const reference of referencedRepositoryPaths(markdown)) {
      checkedReferences += 1;
      if (!(await exists(resolve(resolvedRoot, reference)))) {
        errors.push(`${relativeFile} references missing path: ${reference}`);
      }
    }

    for (const script of referencedNpmScripts(markdown)) {
      checkedReferences += 1;
      if (!(script in packageScripts)) {
        errors.push(
          `${relativeFile} references missing npm script: npm run ${script}`,
        );
      }
    }
  }

  const architecturePath = resolve(
    resolvedRoot,
    "docs/engineering/architecture.md",
  );
  const architecture = (await exists(architecturePath))
    ? await readFile(architecturePath, "utf8")
    : "";
  for (const directory of await sourceDirectories(resolvedRoot)) {
    if (!architecture.includes(directory)) {
      errors.push(`Architecture source map is missing directory: ${directory}`);
    }
  }

  return {
    checkedMarkdownFiles: markdownFiles.length,
    checkedReferences,
    errors,
  };
}
