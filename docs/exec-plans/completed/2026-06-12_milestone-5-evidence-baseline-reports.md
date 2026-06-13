# Milestone 5: Evidence Normalization And Baseline Reports

Date: 2026-06-12
Owner: Codex
Status: Completed
Risk class: medium
Related issue/PR: N/A

## Objective

Create durable runner-independent evidence, structured baseline reports, and a
`report` command that inspects or regenerates historical runs without executing
hooks or Maestro.

## Contract References

- `docs/contracts/cli.md`
- `docs/contracts/report.md`
- `docs/engineering/implementation-plan.md`

## Current State

`verify` executes Maestro and produces valid initial reports, but report
generation consumes an in-memory lifecycle object. There is no normalized
evidence artifact, no historical run resolution, and no `report` command.

## Constraints

- Architecture constraints: reporting consumes normalized retained evidence,
  not runner-specific files or live lifecycle state.
- Product/runtime constraints: `report` never executes hooks or Maestro;
  historical failure does not become the report command exit code; JSON mode
  emits one JSON value without prose.
- Out of scope: advanced diagnosis, suspicious-file ranking, signatures,
  selector extraction, and CI.

## Acceptance Criteria

1. Verify writes runner-independent `evidence/normalized.json`.
2. Baseline Markdown contains outcome, metadata, journey, source, hooks,
   phases, evidence, and suggested action sections.
3. `report latest` and explicit run resolution support compact, JSON, and full
   Markdown output without rerunning external commands.
4. Missing or stale generated reports are regenerated from normalized evidence.
5. The implementation is split into:
   - `feat(evidence): normalize runner and lifecycle facts`
   - `feat(report): generate baseline markdown report`
   - `feat(report): implement report command`

## Implementation Checklist

- [x] Commit 1: add normalized evidence schema and writer.
- [x] Commit 1: add normalization tests and evidence index reference.
- [x] Commit 2: generate canonical result and structured Markdown from
      normalized evidence.
- [x] Commit 2: add baseline report golden/structural tests.
- [x] Commit 3: add latest and explicit run resolution.
- [x] Commit 3: add report regeneration and CLI output modes.
- [x] Commit 3: add historical failure, stale/missing report, and ordering tests.
- [x] Complete docs and run full verification.

## Decision Log

- 2026-06-12: Treat normalized evidence as the report regeneration source ->
  avoids coupling historical reports to live orchestration objects.
- 2026-06-12: Use run manifest creation timestamps for `latest` -> matches the
  CLI contract and avoids modification-time ambiguity.

## Verification

```bash
npm run verify:full
```

Outcome after commit 1 implementation on 2026-06-12: passed.

- format check passed
- lint passed
- type check passed
- 15 test files passed, 76 tests passed
- build passed
- project-map verification passed
- package smoke verification passed
- gate-honesty verification passed

Outcome after commit 2 implementation on 2026-06-12: passed.

- format check passed
- lint passed
- type check passed
- 16 test files passed, 77 tests passed
- build passed
- project-map verification passed
- package smoke verification passed
- gate-honesty verification passed

Outcome after commit 3 implementation on 2026-06-12: passed.

- format check passed
- lint passed
- type check passed
- 17 test files passed, 85 tests passed
- build passed
- project-map verification passed
- package smoke verification passed
- gate-honesty verification passed

## Runtime Evidence

Not required. Fake Maestro and retained fixture runs cover this milestone.

## Risks And Mitigations

- Risk: normalized evidence accidentally becomes a second public result schema.
- Mitigation: keep it internal-but-inspectable and expose `result.json` as the
  stable machine contract.
- Risk: regeneration silently changes historical facts.
- Mitigation: retain lifecycle completion timestamps and source facts in
  normalized evidence; only generation metadata changes.

## Completion Notes

Implemented Milestone 5:

- durable runner-independent normalized evidence
- canonical results generated from normalized evidence
- structured baseline Markdown reports
- shared compact report rendering
- latest, run-ID, and explicit-directory resolution
- missing and stale report regeneration
- `report`, `report --json`, and `report --full`
- historical failure inspection without inheriting its exit code
- report coverage for pass, journey failure, infrastructure failure, cleanup
  failure, interruption, and partial manifests

## Follow-Ups

- [ ] Add deterministic diagnosis fields in Milestone 6.
