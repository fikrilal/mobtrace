export type ArtifactStoreErrorCode =
  | "invalid-manifest"
  | "invalid-path"
  | "invalid-run-id"
  | "invalid-state-transition"
  | "read-failed"
  | "run-already-exists"
  | "run-not-found"
  | "write-failed";

export class ArtifactStoreError extends Error {
  readonly code: ArtifactStoreErrorCode;
  readonly path: string | undefined;

  constructor(
    code: ArtifactStoreErrorCode,
    message: string,
    options: { cause?: unknown; path?: string } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ArtifactStoreError";
    this.code = code;
    this.path = options.path;
  }
}
