# Harness Phase 1: Mechanical Trust

Date: 2026-06-12
Owner: Codex
Status: Completed
Risk class: medium
Related issue/PR: N/A

## Objective

Convert Harness Phase 0's manual repository checks into deterministic local
commands and compose them under `npm run verify:full`.

## Contract References

- `docs/engineering/harness-proposal.md`, Harness Phase 1
- `docs/engineering/guardrails.md`
- `docs/engineering/testing-strategy.md`

## Current State

The repository has an accepted knowledge architecture and a canonical
`npm run verify` command. Documentation links, package installation, and gate
honesty were verified manually during Phase 0 and Milestone 0 but are not
automated.

## Constraints

- Architecture constraints: harness logic stays outside product source and has
  no dependency on MobTrace runtime behavior.
- Product/runtime constraints: public CLI behavior must not change.
- Out of scope: CI, Maestro, product-boundary enforcement, dependency-cruiser,
  duplication detection, and release publishing.

## Acceptance Criteria

1. Documentation and project-map drift fails with an actionable error for
   missing indexed knowledge or undocumented npm commands.
2. Package smoke builds, packs, inspects, installs, and invokes the actual CLI
   tarball in an isolated temporary project.
3. Gate-honesty checks prove documentation drift, package smoke, and strict
   type checking reject controlled violations.
4. `npm run verify:full` runs the canonical gate and every Phase 1 mechanical
   trust check.
5. A clean checkout can run the full gate without persistent generated files.

## Implementation Checklist

- [x] Add shared subprocess support for harness scripts.
- [x] Implement `verify:project-map`.
- [x] Implement `verify:package`.
- [x] Implement `verify:gates`.
- [x] Add focused tests for deterministic checker logic.
- [x] Add `verify:full` and targeted package scripts.
- [x] Update engineering documentation.
- [x] Run clean-install and full-gate verification.

## Decision Log

- 2026-06-12: Use dependency-free TypeScript scripts executed directly by
  Node.js 22.
- 2026-06-12: Gate honesty targets repository composition, not Biome or
  TypeScript's own internal test coverage.
- 2026-06-12: Package smoke validates the actual npm tarball and installed
  executable, not only `dist/cli.js`.

## Verification

- `npm ci` -> passed; 94 packages audited, no vulnerabilities reported
- `npm run verify:full` -> passed
  - format check passed
  - lint passed
  - strict type check passed
  - 9 tests passed across 3 test files
  - production build passed
  - project-map verification passed with 25 Markdown files and 108 references
  - offline package smoke passed
  - project-map, package, and type-check honesty gates passed
- `git diff --check` -> passed
- temporary fixture audit -> no retained package, documentation, or type-check
  fixtures

## Runtime Evidence

The isolated installed-package smoke passed:

- built the production CLI
- packed the intended five files
- verified the executable bit
- installed the tarball into a temporary npm project in offline mode
- verified installed `mobtrace --help`
- verified installed `mobtrace --version` returned `0.0.0`
- removed temporary package and installation directories

## Risks And Mitigations

- Risk: temporary honesty fixtures remain after interruption.
- Mitigation: use unique names and `finally` cleanup; temporary package and
  documentation fixtures live outside the repository.
- Risk: package smoke depends on stale build output.
- Mitigation: the standalone package gate builds before packing.
- Risk: drift checking becomes a prose-style linter.
- Mitigation: validate only paths, indexes, required files, source-map entries,
  and referenced npm scripts.

## Completion Notes

Completed Harness Phase 1.

Delivered:

- repository knowledge and npm-script drift verification
- strict package-content validation
- isolated offline tarball installation and binary smoke
- controlled honesty failures for project-map, package, and type-check gates
- reusable subprocess support for harness scripts
- `npm run verify:full`
- six new tests for project-map and package-shape behavior

No MobTrace product behavior or public CLI contract changed.

## Follow-Ups

- [ ] Add product-boundary enforcement alongside product Milestones 1 through
      3.
