# Public v0.1 Release Checklist

Status: Draft

## Purpose

This checklist defines what must be true before MobTrace should be published as
a public v0.1 package.

## Required Gates

- [x] `npm run verify:full` passes on Linux.
- [ ] macOS runtime verification is completed or explicitly excluded from
  support.
- [x] package smoke installs the packed CLI and runs `mobtrace --help`.
- [ ] README quickstart works from a clean clone.
- [x] CLI, configuration, and report contracts match implementation.
- [x] no hosted service, telemetry, or artifact upload exists.
- [x] generated outputs exclude known secret fixtures.
- [x] interrupted and partial runs remain inspectable.

## Dogfood Gates

- [ ] `mobile-core-kit` can run at least two real flows through MobTrace.
- [ ] one intentional selector failure points to test-harness flow code.
- [ ] one intentional app/navigation failure points to app code.
- [ ] one backend/payload failure points to backend or repository code.
- [x] one environment/device failure is classified as infrastructure.
- [ ] cleanup failure evidence remains visible and does not erase journey
  evidence.

## Documentation Gates

- [x] README states requirements, install command, first run, and report
  inspection.
- [x] example configuration is present.
- [x] local-only data boundary is documented.
- [x] release support matrix is documented.
- [x] known limitations are explicit.

## Packaging Gates

- [x] `package.json` version is set to the intended release version.
- [x] `CHANGELOG.md` has release notes for the version.
- [x] `npm pack --dry-run` contains only intended public files.
- [x] packed package includes README, changelog, contracts, product docs,
  support docs, release checklist, and examples.

## Current Evidence

Collected on 2026-06-13:

- `npm run verify:full` passed on Linux.
- `npm run verify:package` passed.
- `npm audit --audit-level=high` passed after pinning `esbuild@0.28.1`
  through npm overrides.
- `npm pack --dry-run --json` produced `mobtrace-0.1.0.tgz` with 16 intended
  files.
- installable tarball smoke passed in a fresh temporary project:
  `npm install --save-dev mobtrace-0.1.0.tgz`, `npx mobtrace --help`,
  `npx mobtrace init`, and `npx mobtrace doctor --json`.
- installable Git-worktree smoke passed with fake Maestro and a real flow path:
  `doctor.ready=true`, `gitignore` passed, and `.mobtrace/runs` was ignored.
- initial standalone `mobtrace doctor --json` against `mobile-core-kit` passed
  in zero-configuration mode before adding dogfood configuration.
- direct standalone `verify` against `mobile-core-kit`
  `.maestro/flows/auth/login_logout.yaml` correctly reported the missing
  `emulator-5554` device as `device-not-ready` / `infrastructure`.
- standalone configured `verify --flow login-logout --device emulator-5554`
  against `mobile-core-kit` passed with the local backend and emulator running:
  latest current-build run `20260613T030906Z-ede897`, status `passed`,
  outcome `verified-pass`.
- `report latest --json` and `report latest --full` worked against the passing
  dogfood run.
- The latest dogfood report redacts Maestro `-e` values and reports only one
  unredacted sensitive evidence reference, the source diff.
- Dogfood exposed and locally fixed two Maestro adapter issues:
  environment values must be passed as `maestro test -e KEY=VALUE`, and retained
  hook/runner streams must use redacted output.
- v0.1 CLI contract stays with `report --json` and `report --full`; standalone
  `show` and `report --summary` are intentionally deferred.

## Product Decision

Continue to public v0.1 only if dogfood evidence supports:

- materially better first diagnosis than raw Maestro output plus Git diff
- low setup cost for a project with existing Maestro flows
- deterministic, reviewable reports
- correct failure-domain classification for common failures

Pause or narrow the release if MobTrace behaves like:

- a thin Maestro wrapper
- only a prettier report generator
- a project-specific script collection
- a confident but unreliable root-cause guesser
