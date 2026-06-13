# Platform Support

Status: Accepted

## Scope

This document defines the MobTrace v0.1 host-platform baseline. Mobile target
support remains constrained by Maestro and the project under test.

## Supported Hosts

### Linux

Linux is the primary supported and locally verified host. The full repository
gate, subprocess timeout and interruption tests, package smoke test, and
repeated-run reliability test execute on Linux.

### macOS

macOS is supported through the same POSIX subprocess, signal, permission, and
filesystem path. The platform decision and POSIX behavior are covered by
automated contract tests.

The current repository has no macOS CI runner. A release must not claim a
specific macOS version was runtime-verified until that evidence is collected.

## Unsupported Hosts

Windows and other Node.js host platforms are unsupported in v0.1. `mobtrace
doctor` reports an unsupported host as a required failed check instead of
silently assuming POSIX process-group behavior.

## Reliability Evidence

MobTrace records durations for:

- subprocess execution
- lifecycle phases
- the Maestro journey
- hooks
- the complete run

Automated tests cover bounded large-output capture, timeout, interruption,
partial manifests, corrupt optional evidence, and 20 repeated subprocess
executions.

## Data Boundary

MobTrace v0.1 is local-only:

- no artifact upload
- no telemetry
- no hosted service
- no network client dependency in the core

The architecture test rejects Node.js network-client imports and direct
`fetch()` calls under `src/`.
