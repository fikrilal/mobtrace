# Execution Plans

Execution plans are the system of record for non-trivial implementation work.

Use a plan when work spans multiple steps, affects public behavior, has
meaningful risk, or may continue across sessions.

## Lifecycle

1. Copy `docs/exec-plans/_template.md`.
2. Create `docs/exec-plans/active/YYYY-MM-DD_short-topic.md`.
3. Update the same file during implementation.
4. Record decisions, verification, blockers, and runtime evidence.
5. Move it to `docs/exec-plans/completed/` when complete.
6. Add unresolved work to `docs/exec-plans/tech-debt-tracker.md`.

## What Belongs In A Plan

- concrete objective
- contract references
- current state
- constraints and non-goals
- risk class
- observable acceptance criteria
- implementation checklist
- decision log
- verification evidence
- runtime evidence when needed
- risks and rollback
- completion notes and follow-ups

## What Does Not Belong

- tiny edits with no coordination or risk
- broad product roadmaps
- speculative ideas without active implementation

Roadmaps belong in engineering planning documents. Unaccepted proposals belong
under `_WIP/`.

## Completion Rule

A plan is complete only when:

- acceptance criteria are met
- relevant checks were run
- results and skipped checks are recorded honestly
- unresolved debt is tracked
- the plan has moved to `completed/`
