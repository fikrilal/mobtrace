export interface CommandOutput {
  write(value: string): void;
}

export interface CommandIo {
  readonly stderr: CommandOutput;
  readonly stdout: CommandOutput;
}
