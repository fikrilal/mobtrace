# Technology Stack

Status: Accepted

## Decision

MobTrace will be implemented in TypeScript on Node.js.

This is the intended production stack, not a temporary implementation planned
for replacement.

## Runtime And Language

- Runtime: Node.js 22 LTS or newer LTS releases
- Language: TypeScript with strict type checking
- Module system: ECMAScript modules
- Package manager: npm

## Initial Tooling

- CLI parsing: Commander
- Subprocess execution: Execa
- Runtime schema validation: Zod
- YAML parsing: YAML
- Testing: Vitest
- Formatting and linting: Biome
- Library and CLI bundling: tsup
- Source control integration: native `git` commands
- Distribution: npm, including `npx mobtrace`

Dependencies are not automatically approved by this document. Each dependency
must still justify its maintenance, security, and portability cost when added.

## Rationale

MobTrace is an orchestration and report-generation CLI. Its primary work is:

- invoking external tools such as Maestro, ADB, Git, and project build commands
- running optional project setup and cleanup hooks
- reading YAML, JSON, logs, diffs, and test artifacts
- producing stable human-readable and machine-readable reports

Most execution time will be spent waiting for external processes. Native
runtime performance is therefore not expected to be a meaningful bottleneck.

TypeScript and Node.js provide:

- fast development while the command and configuration contracts evolve
- direct npm and `npx` distribution
- mature libraries for subprocesses, configuration, validation, and reporting
- a lower contribution barrier for a general developer tool
- strong static typing when TypeScript strict mode is combined with runtime
  validation at external boundaries
- straightforward support for configurable commands and lifecycle hooks

## Why Not Rust

Rust was considered because it provides standalone binaries, fast startup, low
memory use, and strong compile-time guarantees.

It was not selected because:

- MobTrace is dominated by external process execution rather than computation
- binary builds must be produced and maintained for every supported operating
  system and architecture
- cross-platform release engineering would add work before the product
  contracts are established
- configuration, hooks, and subprocess orchestration can be developed and
  tested faster in TypeScript
- the contributor barrier is higher for the expected audience

Rust is not part of a planned rewrite. A language change should be considered
only if measured operational problems justify it.

## Portability Contract

Public behavior must not depend on TypeScript-specific implementation details.
The following contracts should remain explicit and language-independent:

- CLI commands, arguments, and exit codes
- configuration file schema
- hook input and output protocol
- artifact directory structure
- report JSON schema
- runner and failure-classification behavior

Keeping these contracts stable allows the implementation to evolve without
breaking projects that use MobTrace.

## Initial Constraints

The initial implementation will not include:

- a daemon or background service
- a web interface or hosted service
- an embedded mobile automation engine
- an LLM dependency for core diagnosis
- a general plugin framework
- an assumed future rewrite in another language

MobTrace will orchestrate existing tools and keep its core diagnosis
deterministic.
