# Agent Delivery Loop

Status: Accepted

## Purpose

This guide defines the default delivery loop for agent-authored MobTrace
changes.

## Sources Of Truth

Use these together:

- operating contract: `AGENTS.md`
- documentation index: `docs/README.md`
- architecture: `docs/engineering/architecture.md`
- public contracts: `docs/contracts/`
- guardrails: `docs/engineering/guardrails.md`
- testing: `docs/engineering/testing-strategy.md`
- execution plans: `docs/exec-plans/README.md`

## Loop

### 1. Task Intake

Before implementation:

- state one concrete objective
- define observable acceptance criteria
- identify affected contracts
- list explicit non-goals
- classify risk
- inspect current code and tests
- create an execution plan for non-trivial work

### 2. Risk Classification

`low`:

- documentation
- tests
- narrow internal refactors
- mechanical tooling with no external behavior change

`medium`:

- CLI behavior
- configuration resolution
- report rendering
- public schema implementation
- Git evidence collection
- deterministic diagnosis

`high`:

- subprocess execution
- shell boundaries
- signals and timeouts
- hooks and cleanup
- secret redaction
- artifact deletion
- exit-code precedence
- release and publishing

### 3. Implement

- keep the change focused and reversible
- follow accepted contracts and architecture
- validate untrusted data at external boundaries
- avoid speculative abstractions
- keep project-specific mobile logic outside the core
- update docs when behavior or policy changes

### 4. Verify

Run checks proportional to the change.

Canonical gate:

```bash
npm run verify
```

For non-trivial changes, run `npm run verify:full` after Harness Phase 1
implements it.

Add targeted contract, integration, package, or runtime checks when the
canonical gate does not prove the acceptance criteria.

### 5. Runtime Evidence

Runtime evidence is required when static checks cannot prove behavior.

Examples:

- temporary Git repository transcript
- fake executable result and retained artifacts
- hook sequencing evidence
- timeout or signal evidence
- packaged CLI installation evidence
- controlled Maestro run evidence

Record exact commands, outcomes, and artifact paths. Never include secrets.

### 6. Self-Review

Before completion, verify:

- all acceptance criteria are met
- facts and inferred diagnosis remain distinct
- failure ownership is explicit
- tests cover relevant failure paths
- public contracts remain aligned
- no unrelated refactor is included
- skipped checks and residual risks are documented

### 7. Complete The Plan

For planned work:

- update decisions and verification
- record unresolved follow-ups
- move the plan from `active/` to `completed/`
- add remaining debt to the tracker

## Review Expectations

- `low`: checks are generally sufficient
- `medium`: human review is strongly recommended for public behavior changes
- `high`: human review is required

## Failure-To-Harness Upgrade

When the same failure or review gap appears at least twice, evaluate adding the
lightest effective guardrail:

1. documentation
2. helper or scaffold
3. fixture
4. lint or structural test
5. repository verification script
6. runtime evidence

Do not add a complex gate for a one-off preference.
