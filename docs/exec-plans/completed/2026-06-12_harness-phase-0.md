# Harness Phase 0: Knowledge And Workflow

Date: 2026-06-12
Owner: Codex
Status: Completed
Risk class: medium
Related issue/PR: N/A

## Objective

Establish MobTrace's repository knowledge architecture and agent workflow so a
new agent can discover authoritative documents, plan non-trivial work, apply
risk-appropriate verification, and distinguish accepted policy from drafts.

## Contract References

- `docs/engineering/harness-proposal.md`
- `docs/engineering/implementation-plan.md`, Milestone 0 and execution-plan
  contract

## Current State

At the start of this phase, the repository had product, engineering, and
public-contract documents at the root of `docs/`, one completed execution plan,
and a basic `npm run verify` gate. It had no `AGENTS.md`, documentation index,
engineering workflow guides, ADR lifecycle, execution-plan template, or
technical-debt tracker.

## Constraints

- Architecture constraints: documentation roles must remain explicit and
  links must use the accepted taxonomy.
- Product/runtime constraints: no MobTrace runtime behavior changes.
- Out of scope: package smoke automation, drift scripts, gate-honesty tests,
  `verify:full`, CI, Maestro execution, and product implementation.

## Acceptance Criteria

1. `AGENTS.md` maps agents to every authoritative repository entry point
   without duplicating detailed guides.
2. Existing documentation is reorganized into product, contract, engineering,
   execution-plan, and ADR roles with valid repository-local links.
3. Agent delivery, risk, testing, guardrail, parallel-work, execution-plan,
   and ADR workflows are documented.
4. `_WIP/` is explicitly non-authoritative.
5. Existing build and test verification still passes.

## Implementation Checklist

- [x] Reorganize existing documents into the accepted taxonomy.
- [x] Add `docs/README.md`.
- [x] Add concise root `AGENTS.md`.
- [x] Add architecture, agent-loop, guardrail, testing, and parallel-work
      guides.
- [x] Add execution-plan lifecycle, template, and debt tracker.
- [x] Add ADR lifecycle and template.
- [x] Update README and all repository-local documentation links.
- [x] Verify links manually and run `npm run verify`.

## Decision Log

- 2026-06-12: Preserve document contents during moves and limit edits to link
  repair and role clarification.
- 2026-06-12: Keep `_WIP/` outside `docs/` and explicitly mark it
  non-authoritative.
- 2026-06-12: Defer mechanical drift enforcement to Harness Phase 1.

## Verification

- `git diff --check` -> passed
- repository-wide Markdown path audit -> passed
- required Phase 0 knowledge-file audit -> passed
- stale pre-reorganization path search -> no findings
- `npm run verify` -> passed
  - format check passed
  - lint passed
  - type check passed
  - 3 tests passed
  - production build passed

## Runtime Evidence

Not required. This phase changes repository policy and documentation only.

## Risks And Mitigations

- Risk: moved documents leave stale links.
- Mitigation: search all Markdown references after the move and verify every
  indexed path exists.
- Risk: `AGENTS.md` becomes a duplicated manual.
- Mitigation: keep it as a concise operating contract and route details to
  engineering documents.
- Risk: new policy exceeds what the current repository can enforce.
- Mitigation: clearly distinguish Phase 0 documented expectations from Phase 1
  mechanical enforcement.

## Completion Notes

Completed Harness Phase 0.

Delivered:

- concise root operating contract
- authoritative documentation index
- product, contract, engineering, execution-plan, and ADR taxonomy
- accepted architecture, agent-loop, guardrail, testing, and parallel-agent
  guides
- execution-plan lifecycle, template, and debt tracker
- ADR lifecycle and template
- explicit non-authoritative `_WIP/` policy
- promoted accepted harness proposal

No MobTrace runtime behavior or package configuration changed.

## Follow-Ups

- [ ] Implement Harness Phase 1 mechanical trust in a separate execution plan.
