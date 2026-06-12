# MobTrace Documentation

This index is the entry point for MobTrace documentation. Each document's
status states whether it is draft, proposed, accepted, superseded, or
completed.

Documents under `_WIP/` are discussion material and are not authoritative
unless explicitly adopted.

## Product

- `docs/product/product.md` - user problem, scope, differentiation, metrics,
  and kill criteria

## Public Contracts

- `docs/contracts/cli.md` - commands, streams, options, and exit codes
- `docs/contracts/configuration.md` - project configuration and precedence
- `docs/contracts/report.md` - artifacts, schemas, diagnosis, and redaction

## Engineering

- `docs/engineering/proposal.md` - system design and component boundaries
- `docs/engineering/implementation-plan.md` - ordered product milestones
- `docs/engineering/tech-stack.md` - accepted technology choices
- `docs/engineering/harness-proposal.md` - accepted agent-first harness design
- `docs/engineering/architecture.md` - current source boundaries and dependency
  direction
- `docs/engineering/agent-loop.md` - agent delivery and risk workflow
- `docs/engineering/guardrails.md` - mechanical enforcement strategy
- `docs/engineering/testing-strategy.md` - test layers and evidence expectations
- `docs/engineering/parallel-agent-workflow.md` - concurrent agent isolation

## Execution Plans

- `docs/exec-plans/README.md` - plan lifecycle and usage
- `docs/exec-plans/_template.md` - plan template
- `docs/exec-plans/tech-debt-tracker.md` - unresolved implementation debt
- `docs/exec-plans/active/` - active work
- `docs/exec-plans/completed/` - completed work and verification evidence

## Architecture Decisions

- `docs/adr/README.md` - ADR lifecycle and index
- `docs/adr/template.md` - ADR template

## Document Roles

- Product documents define user need, value, and scope.
- Contracts define externally observable compatibility commitments.
- Engineering documents define implementation boundaries and workflows.
- ADRs record accepted architectural decisions and their consequences.
- Execution plans coordinate one active implementation slice.
- `_WIP/` contains proposals that are not yet accepted policy.

## Status Vocabulary

- `Draft`: incomplete and under discussion
- `Proposed`: complete enough for review
- `Accepted`: authoritative
- `Superseded`: replaced by a later document
- `Completed`: finished execution plan
