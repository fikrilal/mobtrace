# Product Validation

Status: Accepted

## Purpose

This document records the Milestone 8 validation evidence for MobTrace's core
product thesis:

> A failed mobile journey is more useful when the runner output is connected to
> failure domain, source changes, retained evidence, and the next investigation
> action.

## Validation Fixture

The repeatable validation fixture lives at
`test/fixtures/mobile-validation/`.

It is a standalone synthetic mobile project with:

- MobTrace configuration
- Maestro flow files
- fake Maestro executable
- prepare and cleanup hooks
- representative app source files
- real Git source-diff collection during tests

The fake Maestro boundary makes the public test suite deterministic without a
real emulator. MobTrace still exercises normal CLI, configuration, Git, hooks,
evidence, report, regeneration, and exit-code behavior.

## Automated Scenarios

`test/product-validation.test.ts` validates:

| Scenario | Expected ownership area | Expected signal |
| --- | --- | --- |
| passing journey | none | `status=passed`, `exitCode=0` |
| selector mismatch caused by changed flow | test harness | top suspicious file is the changed Maestro flow |
| navigation failure caused by changed app code | application | top suspicious file is navigation source |
| backend HTTP failure from payload change | backend | top suspicious file is repository/API source |
| unavailable or offline device | infrastructure | `device-not-ready` classification |
| preparation failure | test harness | journey is `not-run`, exit code `3` |
| cleanup failure after pass | test harness | journey passed, cleanup failed, exit code `4` |
| cleanup failure after failed journey | test harness | journey diagnosis remains primary, cleanup phase is retained |
| interrupted journey | infrastructure | partial run, exit code `130`, cleanup attempted |
| report regeneration | report contract | historical run regenerates without rerunning journey |

## Product Metrics

Automated fixture baseline:

| Metric | Result |
| --- | --- |
| First suggested investigation area correct | 9 of 9 failure scenarios |
| Top suspicious file contains eventual fix | 3 of 3 source-correlated failure scenarios |
| Artifacts opened before correct investigation area | 0 for classified fixture failures |
| Report regeneration reruns mobile journey | no |
| Repeated-run reliability on documented baseline | covered by `test/reliability-smoke.test.ts` |
| MobTrace overhead beyond fake Maestro | measured in run `durationMs`; no fixed threshold yet |

The cleanup-after-failed-journey scenario preserves the journey failure as the
primary investigation area while keeping cleanup failure visible as secondary
lifecycle evidence.

## Human Dogfood Metrics

For real `mobile-core-kit` dogfood, record these fields per run:

| Field | Meaning |
| --- | --- |
| flow | configured MobTrace flow |
| scenario | pass or failure being validated |
| first area correct | whether `failureDomain` points to the right owner |
| top file correct | whether rank 1 contains or directly owns the fix |
| time to area | time from MobTrace output to correct investigation area |
| artifacts opened | number of artifacts opened before choosing area |
| overhead | MobTrace duration minus underlying Maestro duration |
| notes | wrong ranking, missing evidence, confusing wording |

## Kill Criteria Evaluation

Current Milestone 8 evidence:

- not only a thin Maestro wrapper: MobTrace classifies domains, ranks source
  changes, preserves lifecycle phases, and regenerates reports.
- not only a prettier report generator: JSON and Markdown reports carry
  deterministic diagnosis and suspicious-change correlation.
- not a collection of project-specific scripts: fixture and `mobile-core-kit`
  integration use configuration and external hooks rather than core changes.
- does not require extensive custom integration before value: configured flow
  plus existing Maestro command is enough for baseline evidence.
- does not make confident root-cause claims: reports frame diagnosis as
  investigation guidance and retain evidence.
- not a general automation platform: MobTrace delegates journey execution to
  Maestro and focuses on failure forensics.

Decision: continue toward public v0.1, with real `mobile-core-kit` dogfood
used to validate whether the fixture metrics hold against real emulator runs.
