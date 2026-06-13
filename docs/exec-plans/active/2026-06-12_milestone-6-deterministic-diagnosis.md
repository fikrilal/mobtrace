# Milestone 6: Deterministic Diagnosis

Date: 2026-06-12
Owner: Codex
Status: Active
Risk class: medium
Related issue/PR: N/A

## Objective

Produce deterministic, evidence-backed failure classification, diff-aware
suspicious-change ranking, ownership/signature correlation, and actionable
reports without AI summarization.

## Contract References

- `docs/contracts/configuration.md`
- `docs/contracts/report.md`
- `docs/engineering/implementation-plan.md`

## Current State

Reports contain normalized lifecycle evidence, but failure extraction is
generic and every non-timeout journey failure is temporarily classified as
`test-harness`. Diff artifacts and ownership metadata are retained but not used
for diagnosis. Signature files are configured but not loaded.

## Constraints

- Observed facts must remain separate from inference.
- Unsupported conclusions use `unknown`.
- Ranking must be deterministic and limited to changed/untracked files.
- Ownership biases ranking but never excludes candidates.
- Signature matches must not expose matched secret text.
- No AI or network-based diagnosis.

## Acceptance Criteria

1. Retained runner/hook evidence produces direct failure facts, failure class,
   and failure domain through deterministic precedence.
2. Diff hunks produce evidence-backed suspicious-change rankings with stable
   tie-breaking.
3. Flow ownership and built-in/project signatures bias or enrich diagnosis
   without claiming proven root cause.
4. Compact, Markdown, and JSON reports render the same deterministic diagnosis,
   including regeneration.
5. Unsupported journey failures default to class/domain `unknown`.

## Implementation Checklist

- [x] Commit 1: extract failure facts and classify failures.
- [x] Commit 1: add fixture/table tests for initial classes and domains.
- [x] Commit 2: inspect diff hunks and rank suspicious changes.
- [x] Commit 2: add selector, route/session, API, fixture, and tie-break tests.
- [x] Commit 3: persist diagnosis context, apply ownership, and match built-in
      and project signatures.
- [x] Commit 3: encode at least three historical signatures.
- [ ] Commit 4: render deterministic diagnosis in compact/Markdown/JSON output.
- [ ] Commit 4: verify regenerated reports preserve diagnosis.
- [ ] Complete docs and run full verification.

## Decision Log

- 2026-06-12: Unknown journey failures map to `unknown` -> MobTrace must not
  blame app or harness code without evidence.
- 2026-06-12: Diagnosis consumes retained normalized/log/diff evidence ->
  historical regeneration must not require a live runner.

## Verification

```bash
npm run verify:full
```

Outcome after commit 1 implementation on 2026-06-12: passed.

- format check passed
- lint passed
- type check passed
- 18 test files passed, 97 tests passed
- build passed
- project-map verification passed
- package smoke verification passed
- gate-honesty verification passed

Outcome after commit 3 implementation on 2026-06-12: passed.

- format check passed
- lint passed
- type check passed
- 20 test files passed, 109 tests passed
- build passed
- project-map verification passed
- package smoke verification passed
- gate-honesty verification passed

Outcome after commit 2 implementation on 2026-06-12: passed.

- format check passed
- lint passed
- type check passed
- 19 test files passed, 103 tests passed
- build passed
- project-map verification passed
- package smoke verification passed
- gate-honesty verification passed

## Runtime Evidence

Not required. Recorded textual evidence and deterministic diff fixtures cover
this milestone.

## Risks And Mitigations

- Risk: regex classification overstates certainty.
- Mitigation: narrow patterns, explicit precedence, and `unknown` fallback.
- Risk: ranking appears causal.
- Mitigation: reason wording describes correlation only and reports retain
  “suspicious”, not “root cause”, semantics.

## Completion Notes

Pending.

## Follow-Ups

- [ ] Add new signatures only from reproduced historical failures.
