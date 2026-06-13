# Public v0.1 Release Checklist

Status: Draft

## Purpose

This checklist defines what must be true before MobTrace should be published as
a public v0.1 package.

## Required Gates

- [ ] `npm run verify:full` passes on Linux.
- [ ] macOS runtime verification is completed or clearly excluded from release
  support.
- [ ] package smoke installs the packed CLI and runs `mobtrace --help`.
- [ ] README quickstart works from a clean clone.
- [ ] CLI, configuration, and report contracts match implementation.
- [ ] no hosted service, telemetry, or artifact upload exists.
- [ ] generated outputs exclude known secret fixtures.
- [ ] interrupted and partial runs remain inspectable.

## Dogfood Gates

- [ ] `mobile-core-kit` can run at least two real flows through MobTrace.
- [ ] one intentional selector failure points to test-harness flow code.
- [ ] one intentional app/navigation failure points to app code.
- [ ] one backend/payload failure points to backend or repository code.
- [ ] one environment/device failure is classified as infrastructure.
- [ ] cleanup failure evidence remains visible and does not erase journey
  evidence.

## Documentation Gates

- [ ] README states requirements, install command, first run, and report
  inspection.
- [ ] example configuration is present.
- [ ] local-only data boundary is documented.
- [ ] release support matrix is documented.
- [ ] known limitations are explicit.

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
