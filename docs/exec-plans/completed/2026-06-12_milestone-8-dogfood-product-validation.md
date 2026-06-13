# Milestone 8: Dogfood And Product Validation

Date: 2026-06-12
Owner: Codex
Status: Completed
Risk class: medium
Related issue/PR: N/A

## Objective

Prove MobTrace's CLI, configuration, report, and diagnosis contracts through
repeatable dogfood scenarios, and document whether the product is useful enough
to continue toward public v0.1.

## Contract References

- `docs/product/product.md`
- `docs/contracts/cli.md`
- `docs/contracts/configuration.md`
- `docs/contracts/report.md`
- `docs/engineering/implementation-plan.md`
- `docs/engineering/testing-strategy.md`
- `docs/engineering/platform-support.md`

## Current State

Milestone 7 made the local harness safer and more reliable. The codebase has
unit and integration coverage for individual boundaries, but it does not yet
contain a standalone validation fixture that demonstrates representative
product failures end to end. The README still describes Milestone 0 rather
than the current usable CLI.

## Constraints

- Architecture constraints: keep real mobile-project behavior outside the
  MobTrace core; validation fixtures may simulate external runners.
- Product/runtime constraints: no hosted service, no emulator dependency in
  the public test suite, deterministic runs.
- Out of scope: publishing v0.1, real macOS runtime evidence, and replacing
  `mobile-core-kit` project-specific scripts.

## Acceptance Criteria

1. A standalone fixture project validates pass and representative failure
   scenarios without modifying MobTrace core code.
2. The fixture demonstrates CLI, configuration, report regeneration, exit
   codes, source correlation, failure classification, cleanup behavior, and
   interruption.
3. Product evidence records whether the top diagnosis area and suspicious file
   are correct for each scenario.
4. Installation and first-run docs describe the current CLI behavior.
5. A `mobile-core-kit` reference integration doc explains how to dogfood
   MobTrace without embedding project-specific behavior in the core.
6. A release checklist captures the remaining public v0.1 work and explicitly
   evaluates kill criteria.

## Implementation Checklist

- [x] Add standalone validation fixture and end-to-end product tests.
- [x] Record product validation metrics and scenario outcomes.
- [x] Add `mobile-core-kit` reference integration documentation.
- [x] Update README first-run documentation.
- [x] Add public v0.1 release checklist.
- [x] Run targeted validation tests and `npm run verify:full`.
- [x] Move this plan to `docs/exec-plans/completed/`.

## Decision Log

- 2026-06-12: Use a deterministic fake Maestro fixture for public validation
  tests so the product evidence is repeatable without an emulator.
- 2026-06-12: Treat real `mobile-core-kit` execution as reference dogfood
  documentation, not a repository gate.

## Verification

Completed checks:

```bash
npm test -- test/product-validation.test.ts
npm run verify:full
```

Results:

- `npm test -- test/product-validation.test.ts`: passed, 2 tests.
- `npm run verify:full`: passed on 2026-06-12.

The full gate completed formatting, lint, typecheck, 128 tests across 23 test
files, build, project-map verification, package smoke, and gate-honesty checks.

## Runtime Evidence

- Environment: Linux local development host, Node.js 22 baseline.
- Executed scenario: standalone validation fixture covering pass, selector
  mismatch, app navigation failure, backend HTTP failure, offline device,
  preparation failure, cleanup failure after pass, cleanup failure after
  failed journey, interrupted journey, and report regeneration.
- Artifact paths: validation tests used isolated temporary project copies and
  removed generated artifacts after assertions.
- Notes: `docs/engineering/product-validation.md` records measured scenario
  outcomes and kill-criteria evaluation.

## Risks And Mitigations

- Risk: fake validation becomes too synthetic to prove product value.
- Mitigation: model source changes, hooks, runner output, exit codes, report
  regeneration, and diagnosis expectations through the public CLI.
- Risk: product metrics become vanity numbers.
- Mitigation: record scenario-level correctness and remaining known misses.
- Risk: docs overclaim readiness.
- Mitigation: keep release checklist explicit about blockers and kill criteria.

## Completion Notes

Milestone 8 shipped a deterministic standalone validation fixture, end-to-end
product validation tests, product metrics, `mobile-core-kit` reference
integration guidance, updated first-run README content, and a public v0.1
release checklist. The measured fixture supports continuing toward v0.1 while
tracking one compound-failure diagnosis improvement.

## Follow-Ups

- [x] Add unresolved debt to `docs/exec-plans/tech-debt-tracker.md` if needed.
