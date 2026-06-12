# Engineering Guardrails

Status: Accepted

## Purpose

This document defines how MobTrace turns stable engineering policy into
mechanical feedback.

## Principles

Guardrails should be:

- deterministic
- inexpensive enough for local use
- actionable when they fail
- tied to a real invariant or recurring failure
- implemented through the lightest effective mechanism

Do not add a gate only because another repository has one.

## Current Commands

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

Current enforcement lives in:

- `biome.json`
- `tsconfig.json`
- `vitest.config.ts`
- `package.json`
- tests under `test/`

## Full Harness Gate

Harness Phase 1 provides:

```bash
npm run verify:full
```

It composes repository-native checks for:

- canonical verification
- documentation and project-map drift
- package contents
- isolated package installation and binary smoke
- focused gate-honesty checks

It is required for non-trivial changes.

Targeted commands:

```bash
npm run verify:project-map
npm run verify:package
npm run verify:gates
```

## Gate Honesty

Repository-specific gates should be tested against known violations.

Initial scope:

- documentation drift rejects a missing indexed document
- package smoke rejects a missing or invalid executable
- the composed type-check gate rejects an invalid fixture

Do not add honesty tests that merely retest Biome or TypeScript internals.

## Architecture Enforcement

Use focused structural tests once real module boundaries exist.

Dependency-cruiser is deferred until repository complexity justifies a general
dependency graph tool.

## Adding A Guardrail

Add a guardrail when:

- the same failure or review comment recurs
- the rule is objective
- the future review cost exceeds the enforcement cost
- the failure matters to correctness, compatibility, security, or
  maintainability

Preferred order:

1. documentation
2. helper or scaffold
3. configuration
4. lint or structural test
5. verify script
6. runtime evidence
7. CI

## Suppressions

Suppressions must be narrow and explained.

Do not use baselines or allowlists to hide new:

- contract breakage
- secret exposure
- destructive artifact behavior
- incorrect exit codes
- architecture violations

## CI

CI is deferred until the local harness is established and measured.

Future CI should invoke repository commands rather than duplicate their logic
in workflow configuration.
