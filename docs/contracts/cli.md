# MobTrace CLI Contract

Status: Proposed

## Purpose

This document defines the public command-line interface for MobTrace v0.1.

It covers:

- commands and arguments
- standard output and standard error behavior
- process exit codes
- interruption behavior
- compatibility expectations

It does not define:

- the project configuration schema
- the machine-readable report schema
- the artifact directory layout
- runner-specific implementation details

Those belong to separate contracts.

## Design Goals

The command-line interface should be:

- easy to discover without documentation
- concise enough for repeated human use
- deterministic enough for coding agents and automation
- useful with an existing Maestro journey and no custom integration
- explicit about whether the journey, environment, cleanup, or MobTrace failed
- safe to parse without scraping human-readable prose

## Command Overview

MobTrace v0.1 exposes four commands:

```text
mobtrace init
mobtrace doctor
mobtrace verify --flow <flow>
mobtrace report [run]
```

The commands have separate responsibilities:

| Command | Responsibility |
| --- | --- |
| `init` | Create a starter project configuration |
| `doctor` | Validate whether the project and local environment can run |
| `verify` | Run one mobile journey and produce evidence and diagnosis |
| `report` | Read an existing run without executing the mobile journey |

## Global Options

Global options apply to every command:

```text
--project <path>  Project root. Defaults to the current working directory.
--config <path>   Explicit configuration file.
--no-color        Disable terminal colors.
--quiet           Suppress progress output.
--verbose         Print detailed MobTrace diagnostic output.
-h, --help        Print command help.
-V, --version     Print the MobTrace version.
```

### Global Option Rules

- `--quiet` and `--verbose` are mutually exclusive.
- Relative paths are resolved from the project root.
- `--config` overrides configuration discovery.
- `--project` changes the project root but does not change the caller's shell
  working directory.
- Unknown options are rejected.
- Options that require values fail when their value is missing.
- `--help` exits successfully without validating the project or environment.
- `--version` prints only the version to standard output and exits
  successfully.

## `mobtrace init`

### Purpose

Create a starter MobTrace configuration in an existing project.

### Syntax

```text
mobtrace init [--force]
```

### Options

```text
--force  Replace an existing MobTrace configuration.
```

### Behavior

`init` must:

1. resolve the project root
2. detect whether a MobTrace configuration already exists
3. refuse to overwrite an existing configuration unless `--force` is present
4. create a minimal configuration that documents the next required action
5. create `.gitignore` with `.mobtrace/` when no `.gitignore` exists
6. append `.mobtrace/` to `.gitignore` when the entry is missing
7. avoid duplicating an existing `.mobtrace` ignore entry
8. print created or updated paths

`init` must not prompt before replacement. An existing configuration is
replaced only when `--force` is explicitly present.

`init` must not:

- install Maestro
- modify existing mobile journeys
- create application-specific hooks
- infer backend or fixture behavior
- execute a mobile journey

### Success Output

Normal output should be concise:

```text
Created <configuration-path>
Next: set a flow, then run `mobtrace doctor`.
```

The exact configuration filename is defined by the configuration contract.

## `mobtrace doctor`

### Purpose

Check whether MobTrace can execute a journey in the current project.

### Syntax

```text
mobtrace doctor [--device <id>] [--json]
```

### Options

```text
--device <id>  Validate a specific device.
--json         Print only a machine-readable result to standard output.
```

### Checks

`doctor` should validate applicable prerequisites, including:

- project root
- configuration discovery and validity
- Git repository availability
- Maestro availability
- configured journey existence
- configured hook command validity
- artifact directory writability
- artifact root Git ignore status
- requested device availability

A check that does not apply to the current configuration should be marked as
skipped rather than failed.

Project configuration is optional. When no configuration exists, `doctor`
should validate the zero-integration prerequisites it can discover and mark
configuration-dependent checks as skipped.

### Human Output

Human output should show one line per check:

```text
PASS  project       /work/app
PASS  git           2.51.0
PASS  maestro       2.x
PASS  flow          login
PASS  artifacts     writable
PASS  device        emulator-5554

MobTrace is ready.
```

Failures must include an actionable correction:

```text
FAIL  maestro       command not found
      Install Maestro and ensure `maestro` is available on PATH.
```

### Machine Output

With `--json`:

- standard output contains exactly one JSON value
- no headings, progress messages, or ANSI escape codes are written to standard
  output
- diagnostics may be written to standard error only when MobTrace cannot
  produce valid JSON

The JSON shape belongs to the report contract.

## `mobtrace verify`

### Purpose

Execute one mobile journey, retain its evidence, correlate the outcome with the
current source change, and produce a diagnosis.

### Syntax

```text
mobtrace verify --flow <flow> [options]
```

### Required Options

```text
--flow <flow>  Configured flow name or Maestro flow path.
```

### Options

```text
--device <id>         Target device identifier.
--baseline <git-ref>  Source revision used for change comparison.
--artifacts <path>    Explicit directory for this run's artifacts.
--json                Print only the final machine-readable result to stdout.
```

### Flow Resolution

The value passed to `--flow` is resolved in this order:

1. an exact configured flow name
2. an existing file or directory path relative to the project root

If a configured flow name and a path are both valid for the same value, the
configured flow name wins.

MobTrace must report how the value was resolved in verbose output and run
metadata.

Only one flow may be executed per `verify` command in v0.1. Batch execution is
outside the initial contract.

### Device Resolution

Device selection follows this order:

1. `--device`
2. device configured for the selected flow
3. project-level configured device
4. automatic selection when exactly one compatible device is available

MobTrace must fail before journey execution when:

- no compatible device can be selected
- multiple compatible devices are available and no device was selected
- the selected device is unavailable

MobTrace must not silently choose between multiple devices.

### Baseline Resolution

The baseline determines which source changes are inspected.

Resolution follows this order:

1. `--baseline`
2. configured baseline
3. the current revision's first parent

An invalid baseline must fail before journey execution.

When the current revision has no parent, MobTrace compares against an empty
repository state.

Untracked files are included in source-change collection. Ignored files are not
included.

The detailed diff collection policy belongs to the report contract.

### Run Lifecycle

`verify` must attempt these phases in order:

1. validate invocation and configuration
2. validate required environment
3. create the run artifact location
4. capture source state
5. run optional preparation
6. execute the Maestro journey
7. run optional cleanup
8. normalize evidence
9. generate diagnosis and reports
10. print the final result

Cleanup should run after journey success, journey failure, or interruption when
MobTrace can execute it safely.

Project configuration is not required when command arguments provide enough
information to execute the selected flow.

### Human Output

During a normal interactive run:

- progress is written to standard error
- external runner output is written to standard error and retained as evidence
- the final compact result is written to standard output

Successful example:

```text
PASSED login
Duration: 42s

Report: .mobtrace/runs/2026-06-11T101530Z/report.md
JSON: .mobtrace/runs/2026-06-11T101530Z/result.json
```

Failed example:

```text
FAILED login
Class: selector_mismatch
Domain: test_harness
Failed selector: home_screen

Most suspicious:
1. .maestro/flows/login.yaml
2. lib/features/auth/login_page.dart

Next action:
Compare the expected selector with the final view hierarchy.

Report: .mobtrace/runs/2026-06-11T101530Z/report.md
JSON: .mobtrace/runs/2026-06-11T101530Z/result.json
```

The examples illustrate presentation, not the final report field schema.

### Machine Output

With `--json`:

- standard output contains exactly one compact JSON value
- standard output contains no progress, runner output, headings, or ANSI escape
  codes
- progress and runner output are retained in artifacts
- standard error remains empty during an expected journey pass or failure
- standard error may contain a fatal MobTrace diagnostic only when valid JSON
  cannot be produced

The command's exit code remains meaningful in `--json` mode.

MobTrace records the external runner's original exit status in run evidence and
the structured result. It does not expose arbitrary runner exit codes as its
own process exit code.

### Artifact Safety

If the explicit `--artifacts` path already contains a completed MobTrace run,
MobTrace must refuse to overwrite it.

Partial artifacts should be retained after failure or interruption. The final
output must point to them whenever their location is known.

## `mobtrace report`

### Purpose

Read or regenerate the diagnosis for an existing run without executing a
mobile journey.

### Syntax

```text
mobtrace report [run] [--json] [--full]
```

### Arguments

```text
run  Run identifier or artifact directory. Defaults to `latest`.
```

### Options

```text
--json  Print only the machine-readable result.
--full  Print the full human-readable report.
```

`--json` and `--full` are mutually exclusive.

### Run Resolution

The run argument is resolved in this order:

1. `latest`
2. an exact run identifier
3. an existing artifact directory

`latest` means the most recently created MobTrace run in the current project,
not the most recently modified report file.

### Behavior

`report` must:

- never execute a mobile journey
- never execute project preparation or cleanup hooks
- regenerate derived reports when required source evidence is present and the
  report is missing or stale
- fail clearly when required evidence is missing
- return based on report command success, not the historical journey outcome

This last rule allows users and agents to inspect a failed historical run
without the inspection command itself being treated as a new failed journey.

### Human Output

Default output is the same compact diagnosis printed by `verify`.

`--full` prints the full human-readable report to standard output.

### Machine Output

`--json` follows the same stdout purity rules as `verify --json`.

## Standard Streams

MobTrace reserves streams consistently:

### Standard Output

Standard output is for the command's requested result:

- created path from `init`
- final diagnosis from `verify`
- report content from `report`
- JSON when `--json` is used
- version or help text

### Standard Error

Standard error is for:

- progress
- external runner output
- verbose diagnostics
- warnings
- invocation and fatal errors

This separation allows:

```text
mobtrace verify --flow login --json > result.json
```

without contaminating `result.json` with progress output.

## Exit Codes

MobTrace v0.1 reserves these process exit codes:

| Code | Meaning |
| ---: | --- |
| `0` | Command succeeded; for `verify`, the journey passed and cleanup succeeded |
| `1` | The mobile journey ran and failed |
| `2` | Invalid invocation or invalid project configuration |
| `3` | Environment, infrastructure, or preparation failure prevented a valid journey result |
| `4` | The journey passed, but cleanup failed |
| `5` | MobTrace failed to normalize evidence or generate the requested result |
| `130` | Interrupted by the user |

### Multiple Failures

A single process exit code cannot represent every failure observed during one
run. The structured result must preserve all phase outcomes.

The primary exit code follows this precedence:

1. user interruption: `130`
2. invalid invocation or configuration before execution: `2`
3. environment or preparation failure with no valid journey result: `3`
4. journey failure, including a journey failure followed by cleanup failure:
   `1`
5. journey pass followed by cleanup failure: `4`
6. report-generation failure after an otherwise completed lifecycle: `5`
7. complete pass: `0`

When report generation fails after another failure, MobTrace should preserve
the earlier lifecycle exit code if it can still communicate that outcome
reliably. Otherwise it returns `5`.

### Non-Verify Commands

For `init`, `doctor`, and `report`:

- `0` means the command completed successfully
- `2` means invalid invocation or configuration
- `3` means a required environment dependency is unavailable
- `5` means MobTrace could not complete its own processing
- `130` means interrupted by the user

`report` does not return `1` or `4` based on the historical run.

## Interruption And Signals

On `SIGINT` or `SIGTERM`, MobTrace should:

1. forward termination to the active external process
2. wait for a bounded shutdown period
3. attempt cleanup when safe
4. retain partial evidence
5. mark the run as interrupted

User interruption returns `130`.

A second interruption may terminate immediately. MobTrace cannot guarantee
cleanup after forced termination.

## Timeouts

MobTrace itself should not impose an undocumented global journey timeout.

Timeouts may be defined for:

- preparation
- cleanup
- external runner execution

Defaults and configuration belong to the configuration contract. A timeout
must identify the affected lifecycle phase and retain available evidence.

## Color And Terminal Behavior

- Color is enabled only when the destination stream is an interactive terminal.
- `--no-color` disables all ANSI styling.
- `--json` never emits ANSI styling.
- Output meaning must not depend on color.
- MobTrace should avoid interactive prompts during `verify`, `doctor`, and
  `report`.
- `init` also avoids prompts; replacement requires `--force`.

## Secrets And Redaction

The CLI must not print:

- full process environments
- configured secret values
- authentication tokens discovered in logs
- hook command environment values

Command summaries may print executable names and redacted arguments.

Raw runner output can contain project-controlled sensitive data. MobTrace should
apply configured redaction before displaying it, while the artifact contract
must define treatment of retained raw evidence.

## Compatibility Policy

The following are public compatibility commitments once v0.1 is released:

- command names
- option names and meanings
- standard stream separation
- exit-code meanings
- JSON output validity

Additive options may be introduced in minor releases.

Removing or changing command behavior, option meaning, or exit-code meaning
requires a major release.

Human-readable wording and formatting may evolve in minor releases as long as:

- the documented information remains present
- machine consumers use `--json`
- standard stream separation remains stable

Experimental behavior must be explicitly marked and must not silently become a
stable contract.

## Explicitly Deferred

The following are outside the v0.1 CLI contract:

- multiple flows in one `verify` command
- parallel journey execution
- watch mode
- interactive device selection
- arbitrary passthrough arguments to Maestro
- a runner plugin management command
- remote artifact upload
- hosted authentication
- automatic AI diagnosis
- a separate `show` command

The full report is available through `mobtrace report --full`, so `show` would
be redundant.

## Acceptance Criteria

This CLI contract is ready to accept when:

- a new user can identify the correct command from `mobtrace --help`
- a coding agent can consume `verify --json` without parsing prose
- a journey failure is distinguishable from environment and cleanup failures
- `report` can inspect historical failures without returning the historical
  journey exit code
- stdout and stderr responsibilities are unambiguous
- the command surface remains small enough to document on one help screen
