export class ConfigurationError extends Error {
  readonly path: string | undefined;

  constructor(message: string, path?: string) {
    super(message);
    this.name = "ConfigurationError";
    this.path = path;
  }
}
