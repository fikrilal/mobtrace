import { Command } from "commander";

import { MOBTRACE_VERSION } from "./version.js";

export function createProgram(): Command {
  return new Command()
    .name("mobtrace")
    .description(
      "Diff-aware mobile regression evidence and diagnosis for coding agents.",
    )
    .version(MOBTRACE_VERSION);
}
