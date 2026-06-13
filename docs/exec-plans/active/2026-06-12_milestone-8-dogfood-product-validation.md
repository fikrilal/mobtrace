# Milestone 8: Dogfood And Product Validation

Date: 2026-06-12
Owner: Codex
Status: Active
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

- [ ] Add standalone validation fixture and end-to-end product tests.
- [ ] Record product validation metrics and scenario outcomes.
- [ ] Add `mobile-core-kit` reference integration documentation.
- [ ] Update README first-run documentation.
- [ ] Add public v0.1 release checklist.
- [ ] Run targeted validation tests and `npm run verify:full`.
- [ ] Move this plan to `docs/exec-plans/completed/`.

## Decision Log

- 2026-06-12: Use a deterministic fake Maestro fixture for public validation
  tests so the product evidence is repeatable without an emulator.
- 2026-06-12: Treat real `mobile-core-kit` execution as reference dogfood
  documentation, not a repository gate.

## Verification

Planned checks:

```bash
npm test -- test/product-validation.test.ts
npm run verify:full
```

Record checks not run and why.

## Runtime Evidence

- Environment: pending.
- Executed scenario: pending.
- Artifact paths: pending.
- Notes: pending.

## Risks And Mitigations

- Risk: fake validation becomes too synthetic to prove product value.
- Mitigation: model source changes, hooks, runner output, exit codes, report
  regeneration, and diagnosis expectations through the public CLI.
- Risk: product metrics become vanity numbers.
- Mitigation: record scenario-level correctness and remaining known misses.
- Risk: docs overclaim readiness.
- Mitigation: keep release checklist explicit about blockers and kill criteria.

## Completion Notes

Pending.

## Follow-Ups

- [ ] Add unresolved debt to `docs/exec-plans/tech-debt-tracker.md` if needed.
