#!/usr/bin/env node

import { CommanderError } from "commander";

import { MobtraceCommandError } from "./cli-error.js";
import { createProgram } from "./program.js";

const program = createProgram().exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof MobtraceCommandError) {
    if (error.message.length > 0) {
      process.stderr.write(`${error.message}\n`);
    }
    process.exitCode = error.exitCode;
  } else if (error instanceof CommanderError) {
    process.exitCode = error.exitCode === 0 ? 0 : 2;
  } else {
    throw error;
  }
}
