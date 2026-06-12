import { randomBytes } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { ArtifactStoreError } from "./errors.js";

function temporarySiblingPath(targetPath: string): string {
  const suffix = randomBytes(6).toString("hex");
  return join(
    dirname(targetPath),
    `.${basename(targetPath)}.${process.pid}.${suffix}.tmp`,
  );
}

export async function writeTextAtomic(
  targetPath: string,
  content: string,
): Promise<void> {
  const temporaryPath = temporarySiblingPath(targetPath);
  let file: Awaited<ReturnType<typeof open>> | undefined;

  try {
    await mkdir(dirname(targetPath), { mode: 0o700, recursive: true });
    file = await open(temporaryPath, "wx", 0o600);
    await file.writeFile(content, "utf8");
    await file.sync();
    await file.close();
    file = undefined;
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await file?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw new ArtifactStoreError(
      "write-failed",
      `Could not atomically write ${targetPath}`,
      { cause: error, path: targetPath },
    );
  }
}

export async function writeJsonAtomic(
  targetPath: string,
  value: unknown,
): Promise<void> {
  let content: string;
  try {
    const serialized = JSON.stringify(value, null, 2);
    if (serialized === undefined) {
      throw new TypeError("Value is not representable as JSON");
    }
    content = `${serialized}\n`;
  } catch (error) {
    throw new ArtifactStoreError(
      "write-failed",
      `Could not serialize JSON for ${targetPath}`,
      { cause: error, path: targetPath },
    );
  }
  await writeTextAtomic(targetPath, content);
}
