export class MobtraceCommandError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = "MobtraceCommandError";
    this.exitCode = exitCode;
  }
}
