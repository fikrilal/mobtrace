# Repository Guidelines

## Purpose

MobTrace is a TypeScript CLI that produces diff-aware mobile regression
evidence and deterministic diagnosis for coding agents.

Keep changes small, explicit, and aligned with the documented product scope
and public contracts.

## Sources Of Truth

Start at `docs/README.md`.

High-signal references:

- product scope: `docs/product/product.md`
- public CLI contract: `docs/contracts/cli.md`
- configuration contract: `docs/contracts/configuration.md`
- report and artifact contract: `docs/contracts/report.md`
- architecture: `docs/engineering/architecture.md`
- implementation roadmap: `docs/engineering/implementation-plan.md`
- agent delivery loop: `docs/engineering/agent-loop.md`
- testing strategy: `docs/engineering/testing-strategy.md`
- guardrails: `docs/engineering/guardrails.md`
- execution plans: `docs/exec-plans/README.md`

Documents under `_WIP/` are proposals and are not authoritative unless the
current task explicitly adopts them.

## Simplicity

- Implement the minimum complete behavior required by the task.
- Do not add speculative flexibility, plugin systems, or abstractions.
- Prefer existing repository boundaries and terminology.
- Keep public APIs small and deterministic.
- Keep observed facts separate from inferred diagnosis.
- Keep project-specific mobile behavior outside the MobTrace core.

## Planning

Create an execution plan for non-trivial work:

1. copy `docs/exec-plans/_template.md`
2. place it under `docs/exec-plans/active/`
3. update decisions and verification during implementation
4. move it to `docs/exec-plans/completed/` when complete
5. record unresolved debt in `docs/exec-plans/tech-debt-tracker.md`

Follow `docs/engineering/agent-loop.md` for risk classification and evidence
expectations.

## Verification

Use native npm commands.

Targeted checks:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Canonical local gate:

```bash
npm run verify
```

For non-trivial changes, run:

```bash
npm run verify:full
```

Never claim a check passed unless it was actually run. Record skipped checks
and their reasons.

## Risk

- `low`: docs, tests, narrow internal refactors, mechanical tooling
- `medium`: CLI behavior, configuration, reports, schemas, Git collection,
  deterministic diagnosis
- `high`: subprocesses, hooks, signals, timeouts, cleanup, redaction, artifact
  deletion, exit-code precedence, release and publishing

Medium- and high-risk behavior requires targeted integration or runtime
evidence when static checks cannot prove correctness. High-risk changes require
human review.

## Source Control

- Do not commit or push unless explicitly requested.
- Use Conventional Commits when committing.
- Never use destructive cleanup or force-push without explicit permission.
- Do not revert unrelated user changes.
- Prefer one Git worktree and branch per concurrent agent task.

## Harness Improvement

When the same failure, review comment, or workflow gap occurs at least twice,
evaluate promoting it into documentation, a helper, a scaffold, a fixture, a
lint, a verification script, or runtime evidence.

Add only the lightest guardrail justified by the recurring problem.
