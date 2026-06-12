# Milestone 0 Repository Foundation

Status: Completed
Milestone: 0 - Repository Foundation

## Objective

Create the minimum reliable TypeScript and Node.js foundation needed to build,
test, package, and invoke the MobTrace CLI.

## Contract References

- `docs/engineering/tech-stack.md`
- `docs/engineering/implementation-plan.md`, Milestone 0
- `docs/contracts/cli.md`, global `--help` and `--version` behavior

## Current State

The repository contains accepted product and engineering documents. It has no
package manifest, source code, tests, or development tool configuration.

## Scope

- npm package metadata and Node.js version constraint
- strict TypeScript and ECMAScript module configuration
- Commander-based CLI bootstrap
- `mobtrace --help` and `mobtrace --version`
- production build through tsup
- unit tests through Vitest
- formatting and linting through Biome
- one aggregate local verification command
- package-content and installed-binary smoke verification
- basic development instructions

## Out Of Scope

- MobTrace subcommands
- configuration loading
- Maestro execution
- artifact generation
- report generation
- diagnosis
- CI workflows
- release publishing

## Implementation Steps

1. Add npm package metadata and runtime constraints.
2. Configure TypeScript, tsup, Vitest, and Biome.
3. Add a small CLI construction boundary and executable entry point.
4. Test help, version, and unsupported-command behavior.
5. Add development and verification documentation.
6. Install dependencies and run the complete verification sequence.
7. Build a package tarball, install it into an isolated directory, and invoke
   the declared `mobtrace` binary.

## Tests And Verification

- `npm ci`
- `npm run verify`
- `npm pack --dry-run`
- install the packed artifact into a temporary npm project
- invoke `mobtrace --help`
- invoke `mobtrace --version`

## Risks And Rollback

- Tool-version incompatibility: keep configuration minimal and use versions
  compatible with Node.js 22.
- CLI metadata drift: source the displayed version directly from the package
  manifest.
- Packaging mistakes: verify the actual packed artifact rather than only
  invoking the repository build output.

Rollback is removal of the scaffold files. No product data or public runtime
contract beyond help and version is introduced.

## Completion Record

Completed on June 12, 2026.

Implemented:

- npm and Node.js version constraints
- strict TypeScript and ECMAScript module configuration
- Commander CLI bootstrap
- Biome formatting and linting
- Vitest unit tests
- tsup production bundling
- aggregate `npm run verify` command
- package metadata and executable declaration
- development instructions

Verification:

- `npm ci`: passed with no reported vulnerabilities
- `npm run verify`: passed
- formatting: passed
- linting: passed
- type checking: passed
- tests: 3 passed
- production build: passed
- package dry run: contained only the intended five files
- isolated tarball installation: passed
- installed `mobtrace --help`: passed
- installed `mobtrace --version`: printed `0.0.0`
