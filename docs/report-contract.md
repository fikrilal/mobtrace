# MobTrace Report And Artifact Contract

Status: Proposed

## Purpose

This document defines the MobTrace v0.1 contract for:

- run artifact directories
- lifecycle and result status
- machine-readable run results
- human-readable reports
- evidence references
- source-change evidence
- diagnosis output
- doctor results
- report regeneration and compatibility

It does not define command syntax or project configuration. Those are defined
in `docs/cli-contract.md` and `docs/configuration-contract.md`.

## Design Goals

Reports and artifacts should:

- distinguish journey failures from infrastructure, preparation, cleanup, and
  MobTrace processing failures
- remain useful after the original process exits
- preserve facts without overstating inferred root cause
- be readable by humans and stable enough for coding agents
- retain original external-tool outcomes
- use portable references rather than machine-specific absolute paths
- remain inspectable after interruption or partial failure
- avoid exposing known secrets in generated reports

## Core Model

A MobTrace run has three separate outcome layers:

1. **Overall outcome**: the primary result represented by the MobTrace exit
   code.
2. **Journey outcome**: whether the mobile journey passed, failed, did not run,
   or was interrupted.
3. **Phase outcomes**: the result of validation, preparation, journey,
   cleanup, normalization, and reporting.

These outcomes must not be collapsed into one boolean.

For example:

- a journey can pass while cleanup fails
- a journey can fail while cleanup also fails
- preparation can fail before the journey runs
- the journey can fail even if report generation later fails

The report must preserve every observed outcome.

## Artifact Root

The default artifact root is:

```text
<project-root>/.mobtrace/runs
```

Configuration may change the root. A CLI override may select an explicit run
directory.

When MobTrace generates the directory, its path is:

```text
<artifact-root>/<run-id>
```

## Run Identifier

The v0.1 run identifier format is:

```text
YYYYMMDDTHHMMSSZ-xxxxxx
```

Where:

- the timestamp is UTC
- `xxxxxx` is a lowercase hexadecimal random suffix

Example:

```text
20260611T101530Z-a13f09
```

The suffix prevents collisions between runs created within the same second.

Run identifiers are opaque to consumers. Consumers may display them but should
not parse their timestamp.

## Stable Artifact Layout

The public v0.1 run layout is:

```text
<run-dir>/
  run.json
  result.json
  report.md
  mobtrace.log
  source/
    metadata.json
    changed-files.json
    diff.patch
  hooks/
    <hook-id>/
      result.json
      stdout.log
      stderr.log
  runner/
    result.json
    stdout.log
    stderr.log
    artifacts/
  evidence/
    normalized.json
    diagnosis-context.json
```

### Required Files

`run.json` is created when the run directory is initialized and is required for
every run, including interrupted and partial runs.

`result.json` and `report.md` are required when report generation completes.

Other files are created only when their corresponding phase runs or evidence is
available.

### Additional Files

MobTrace and external runners may add files below:

- `hooks/<hook-id>/`
- `runner/artifacts/`
- `evidence/`

Consumers must ignore unrecognized files.

MobTrace must not place project secrets in filenames.

## Path Rules

Paths stored in public JSON reports:

- are relative to the run directory
- use `/` as the separator on every operating system
- must not contain `..`
- must not resolve outside the run directory

Project source paths are relative to the Git repository root and also use `/`.

Absolute local paths may appear in verbose logs, but they are not part of the
portable report contract.

## Write And Finalization Rules

MobTrace should:

- create the run directory before executing hooks or the runner
- write structured files atomically through a temporary sibling file and
  rename
- update `run.json` as lifecycle state changes
- retain partial files after failure or interruption
- never overwrite a completed run directory
- avoid modifying raw external evidence during report regeneration

A run is complete only when `run.json` contains:

```json
{
  "state": "completed"
}
```

Interrupted and unrecoverable partial runs use:

```json
{
  "state": "partial"
}
```

## `run.json`

`run.json` is the lifecycle manifest. It exists even when no final report can be
generated.

Required shape:

```json
{
  "schemaVersion": 1,
  "runId": "20260611T101530Z-a13f09",
  "state": "running",
  "createdAt": "2026-06-11T10:15:30.123Z",
  "updatedAt": "2026-06-11T10:15:31.456Z",
  "completedAt": null,
  "mobtraceVersion": "0.1.0",
  "project": {
    "sourceControl": null
  },
  "flow": {
    "name": "login",
    "path": ".maestro/flows/login.yaml",
    "resolution": "configured"
  },
  "device": {
    "id": "emulator-5554"
  },
  "phases": []
}
```

### Manifest State

`state` is one of:

- `running`
- `completed`
- `partial`

### Timestamps

- Timestamps use RFC 3339 UTC with millisecond precision.
- `completedAt` is `null` until the run reaches a terminal state.
- `updatedAt` changes whenever the manifest is rewritten.

### Project

`project.sourceControl` is `git` after Git discovery succeeds and `null`
before discovery or when no supported source-control system is available.

The manifest does not store the absolute project or repository path.

### Flow

`flow.resolution` is one of:

- `configured`
- `path`

`flow.name` is `null` for a direct path without a configured flow name.

### Device

`device.id` is `null` until device selection completes.

Additional normalized device metadata may be added in future compatible
versions.

## Phase Results

`run.json` and `result.json` use the same phase result shape:

```json
{
  "id": "journey",
  "status": "failed",
  "startedAt": "2026-06-11T10:15:35.000Z",
  "endedAt": "2026-06-11T10:16:17.000Z",
  "durationMs": 42000,
  "exitCode": 1,
  "timedOut": false,
  "error": {
    "code": "runner-exit-nonzero",
    "message": "Maestro reported a failed journey."
  },
  "evidence": [
    "runner-result"
  ]
}
```

### Phase Identifiers

Stable v0.1 phase identifiers are:

- `validation`
- `source`
- `prepare-project`
- `prepare-flow`
- `journey`
- `cleanup-flow`
- `cleanup-project`
- `normalize`
- `report`

### Phase Status

`status` is one of:

- `pending`
- `running`
- `passed`
- `failed`
- `skipped`
- `interrupted`

### Phase Error

`error` is `null` when the phase has no error.

Error fields:

- `code`: stable kebab-case identifier
- `message`: concise human-readable summary

External command stderr is not embedded in the error message. It is referenced
as evidence.

### Phase Exit Code

`exitCode` is:

- the original external process exit code when one exists
- `null` when no external process ran or no exit code was available

## Final Result

`result.json` is the canonical machine-readable result returned by:

```text
mobtrace verify --json
mobtrace report <run> --json
```

It contains one JSON object with this top-level shape:

```json
{
  "schemaVersion": 1,
  "runId": "20260611T101530Z-a13f09",
  "mobtraceVersion": "0.1.0",
  "createdAt": "2026-06-11T10:15:30.123Z",
  "completedAt": "2026-06-11T10:16:20.000Z",
  "durationMs": 49877,
  "generatedAt": "2026-06-11T10:16:20.000Z",
  "generatedByVersion": "0.1.0",
  "sourceRunCompletedAt": "2026-06-11T10:16:20.000Z",
  "status": "failed",
  "outcome": "journey-failed",
  "exitCode": 1,
  "flow": {},
  "device": {},
  "source": {},
  "journey": {},
  "phases": [],
  "failure": {},
  "diagnosis": {},
  "evidence": [],
  "reports": {}
}
```

Unknown top-level fields must be ignored by consumers.

## Overall Status

`status` is one of:

- `passed`
- `failed`
- `error`
- `interrupted`

Meaning:

- `passed`: the journey passed, required cleanup passed, and the final result
  was generated
- `failed`: the journey ran and failed
- `error`: no journey failure exists, but preparation, infrastructure, cleanup,
  or MobTrace processing failed
- `interrupted`: the run was interrupted

## Primary Outcome

`outcome` is one of:

- `verified-pass`
- `journey-failed`
- `invalid-invocation`
- `preparation-failed`
- `infrastructure-failed`
- `cleanup-failed`
- `processing-failed`
- `interrupted`

The value follows the exit-code precedence in `docs/cli-contract.md`.

Secondary failures remain visible in `phases`.

## Result Exit Code

`exitCode` is the MobTrace process exit code defined by the CLI contract.

It is not the Maestro exit code. The original runner exit code is stored in
`journey.exitCode` and the `journey` phase.

## Flow Result

```json
{
  "name": "login",
  "path": ".maestro/flows/login.yaml",
  "resolution": "configured",
  "runner": "maestro"
}
```

Fields:

- `name`: configured name or `null`
- `path`: project-relative normalized path
- `resolution`: `configured` or `path`
- `runner`: `maestro` in v0.1

## Device Result

```json
{
  "id": "emulator-5554",
  "platform": "android",
  "available": true
}
```

Fields:

- `id`: selected device identifier or `null`
- `platform`: `android`, `ios`, or `unknown`
- `available`: last observed availability or `null`

MobTrace v0.1 may support only platforms supported by its Maestro integration.
The schema remains explicit so unknown values are not inferred.

## Source Result

```json
{
  "available": true,
  "branch": "feature/profile",
  "head": "4f81a7c421eed3a4ae70d72a5db8f0cc5a9c8d11",
  "baseline": "origin/main",
  "baselineCommit": "55cacbf81f9d66e32429781d981e58bd5bb2aa40",
  "dirty": true,
  "changedFileCount": 3,
  "untrackedFileCount": 1,
  "metadata": "source/metadata.json",
  "changedFiles": "source/changed-files.json",
  "diff": "source/diff.patch"
}
```

Rules:

- Commit identifiers use the full object ID in retained metadata.
- Human reports may display an unambiguous short form.
- `branch` is `null` in detached HEAD state.
- `baseline` preserves the requested revision string.
- `baselineCommit` is the resolved commit object ID.
- Source paths reference run-relative evidence files.

When source evidence is unavailable:

```json
{
  "available": false,
  "reason": "not-a-git-worktree"
}
```

Source unavailability prevents diff-aware ranking but does not invalidate a
runner result when the zero-integration journey can otherwise execute.

## Journey Result

```json
{
  "status": "failed",
  "startedAt": "2026-06-11T10:15:35.000Z",
  "endedAt": "2026-06-11T10:16:17.000Z",
  "durationMs": 42000,
  "exitCode": 1,
  "timedOut": false,
  "command": {
    "executable": "maestro",
    "arguments": [
      "test",
      "<flow>"
    ]
  },
  "result": "runner/result.json",
  "stdout": "runner/stdout.log",
  "stderr": "runner/stderr.log"
}
```

`journey.status` is one of:

- `passed`
- `failed`
- `not-run`
- `interrupted`

Command arguments must be redacted and normalized. Secret values and absolute
project paths must not appear.

## Failure Facts

`failure` describes direct observations, not inferred ownership.

Pass result:

```json
{
  "summary": null,
  "failedCommand": null,
  "failedSelector": null,
  "message": null
}
```

Failure result:

```json
{
  "summary": "Expected element was not visible.",
  "failedCommand": "assertVisible",
  "failedSelector": "home_screen",
  "message": "Element not found: home_screen"
}
```

Rules:

- Values come from runner evidence or MobTrace lifecycle facts.
- Values are redacted.
- Missing values are `null`.
- The report must not synthesize a selector when none was observed.

## Diagnosis Result

`diagnosis` contains deterministic inference:

```json
{
  "failureClass": "selector-mismatch",
  "failureDomain": "test-harness",
  "matchedSignatures": [
    {
      "id": "assertion-false-missing-id",
      "action": "Compare the selector with the final view hierarchy.",
      "evidence": [
        "runner-result",
        "view-hierarchy"
      ]
    }
  ],
  "suspiciousChanges": [
    {
      "rank": 1,
      "path": ".maestro/flows/login.yaml",
      "reasons": [
        {
          "code": "changed-selector",
          "message": "The failed selector changed in this flow.",
          "evidence": [
            "source-diff",
            "runner-result"
          ]
        }
      ]
    }
  ],
  "suggestedAction": "Compare the selector with the final view hierarchy."
}
```

### Failure Class

Stable initial classes:

- `none`
- `device-not-ready`
- `runner-unavailable`
- `runner-error`
- `runner-timeout`
- `selector-mismatch`
- `input-not-applied`
- `app-did-not-navigate`
- `backend-http-error`
- `fixture-setup-failed`
- `fixture-cleanup-failed`
- `processing-error`
- `unknown`

New classes may be added compatibly. Consumers must handle unknown values.

### Failure Domain

Stable initial domains:

- `none`
- `application`
- `test-harness`
- `backend`
- `infrastructure`
- `unknown`

Pass reports use:

```json
{
  "failureClass": "none",
  "failureDomain": "none"
}
```

### Matched Signatures

Signature matches:

- are ordered by configuration file order, then declaration order
- include only signatures that matched
- must reference supporting evidence
- must not expose secret matched text

An empty list means no known signature matched.

### Suspicious Changes

Suspicious changes:

- are ordered by ascending `rank`
- use contiguous ranks beginning at `1`
- contain only changed or untracked project files
- include deterministic reason codes
- do not claim root cause
- are limited to the ten highest-ranked paths in v0.1

Ties are resolved by project-relative path in ascending bytewise order.

If no source evidence exists, the list is empty.

### Suggested Action

`suggestedAction`:

- is always a non-empty string
- is based on the highest-priority deterministic diagnosis
- states an inspection or corrective action
- must not claim that a suspicious file is the proven root cause

For a pass:

```text
No failure detected. Keep this run as baseline evidence.
```

## Evidence Index

`evidence` is an array of references:

```json
[
  {
    "id": "runner-result",
    "type": "runner-result",
    "path": "runner/result.json",
    "mediaType": "application/json",
    "description": "Normalized Maestro result.",
    "redacted": true,
    "sensitive": false
  },
  {
    "id": "runner-stdout",
    "type": "runner-log",
    "path": "runner/stdout.log",
    "mediaType": "text/plain",
    "description": "Original Maestro standard output.",
    "redacted": false,
    "sensitive": true
  }
]
```

Fields:

- `id`: unique stable identifier within the run
- `type`: evidence category
- `path`: run-relative path
- `mediaType`: IANA media type
- `description`: concise human-readable description
- `redacted`: whether MobTrace applied redaction
- `sensitive`: whether the file may contain project-controlled sensitive data

Stable initial evidence types:

- `run-manifest`
- `source-metadata`
- `source-changed-files`
- `source-diff`
- `hook-result`
- `hook-log`
- `runner-result`
- `runner-log`
- `junit`
- `screenshot`
- `view-hierarchy`
- `device-log`
- `normalized-evidence`
- `human-report`
- `machine-report`
- `mobtrace-log`
- `other`

Consumers must use evidence IDs and paths from the index instead of assuming an
optional runner artifact exists.

## Reports Result

```json
{
  "markdown": "report.md",
  "json": "result.json"
}
```

Both fields are run-relative paths.

## Complete Failed Result Example

```json
{
  "schemaVersion": 1,
  "runId": "20260611T101530Z-a13f09",
  "mobtraceVersion": "0.1.0",
  "createdAt": "2026-06-11T10:15:30.123Z",
  "completedAt": "2026-06-11T10:16:20.000Z",
  "durationMs": 49877,
  "generatedAt": "2026-06-11T10:16:20.000Z",
  "generatedByVersion": "0.1.0",
  "sourceRunCompletedAt": "2026-06-11T10:16:20.000Z",
  "status": "failed",
  "outcome": "journey-failed",
  "exitCode": 1,
  "flow": {
    "name": "login",
    "path": ".maestro/flows/login.yaml",
    "resolution": "configured",
    "runner": "maestro"
  },
  "device": {
    "id": "emulator-5554",
    "platform": "android",
    "available": true
  },
  "source": {
    "available": true,
    "branch": "feature/profile",
    "head": "4f81a7c421eed3a4ae70d72a5db8f0cc5a9c8d11",
    "baseline": "origin/main",
    "baselineCommit": "55cacbf81f9d66e32429781d981e58bd5bb2aa40",
    "dirty": true,
    "changedFileCount": 3,
    "untrackedFileCount": 1,
    "metadata": "source/metadata.json",
    "changedFiles": "source/changed-files.json",
    "diff": "source/diff.patch"
  },
  "journey": {
    "status": "failed",
    "startedAt": "2026-06-11T10:15:35.000Z",
    "endedAt": "2026-06-11T10:16:17.000Z",
    "durationMs": 42000,
    "exitCode": 1,
    "timedOut": false,
    "command": {
      "executable": "maestro",
      "arguments": [
        "test",
        "<flow>"
      ]
    },
    "result": "runner/result.json",
    "stdout": "runner/stdout.log",
    "stderr": "runner/stderr.log"
  },
  "phases": [
    {
      "id": "journey",
      "status": "failed",
      "startedAt": "2026-06-11T10:15:35.000Z",
      "endedAt": "2026-06-11T10:16:17.000Z",
      "durationMs": 42000,
      "exitCode": 1,
      "timedOut": false,
      "error": {
        "code": "runner-exit-nonzero",
        "message": "Maestro reported a failed journey."
      },
      "evidence": [
        "runner-result"
      ]
    }
  ],
  "failure": {
    "summary": "Expected element was not visible.",
    "failedCommand": "assertVisible",
    "failedSelector": "home_screen",
    "message": "Element not found: home_screen"
  },
  "diagnosis": {
    "failureClass": "selector-mismatch",
    "failureDomain": "test-harness",
    "matchedSignatures": [],
    "suspiciousChanges": [
      {
        "rank": 1,
        "path": ".maestro/flows/login.yaml",
        "reasons": [
          {
            "code": "changed-selector",
            "message": "The failed selector changed in this flow.",
            "evidence": [
              "source-diff",
              "runner-result"
            ]
          }
        ]
      }
    ],
    "suggestedAction": "Compare the selector with the final view hierarchy."
  },
  "evidence": [
    {
      "id": "runner-result",
      "type": "runner-result",
      "path": "runner/result.json",
      "mediaType": "application/json",
      "description": "Normalized Maestro result.",
      "redacted": true,
      "sensitive": false
    },
    {
      "id": "source-diff",
      "type": "source-diff",
      "path": "source/diff.patch",
      "mediaType": "text/x-diff",
      "description": "Source changes compared with the selected baseline.",
      "redacted": false,
      "sensitive": true
    }
  ],
  "reports": {
    "markdown": "report.md",
    "json": "result.json"
  }
}
```

Examples may omit phase and evidence entries that do not affect the illustrated
contract. Real results include all observed phases and indexed evidence.

## Human Report

`report.md` is the canonical detailed human-readable report.

It should contain these sections in order:

1. title and compact outcome
2. journey and run metadata
3. direct failure facts
4. diagnosis
5. suspicious changes
6. matched signatures
7. lifecycle phase outcomes
8. evidence links
9. suggested next action

Sections with no applicable content may state `None` or be omitted, except the
outcome, metadata, lifecycle, evidence, and suggested-action sections.

The report must:

- distinguish observed facts from inferred diagnosis
- use run-relative links
- avoid embedding full logs or diffs
- be readable as plain Markdown
- contain no ANSI escape codes
- apply configured redaction

Human report wording is not a machine compatibility contract.

## Compact Diagnosis

The compact diagnosis printed by `verify` and default `report` is derived from
`result.json`.

It includes:

- overall status
- flow name or path
- failure class and domain when applicable
- failed selector when observed
- up to three suspicious changes
- suggested action
- Markdown and JSON report paths

Consumers that require stable fields must use JSON output.

## Normalized Evidence

`evidence/normalized.json` contains runner-independent facts used by the
diagnosis engine.

It is an internal-but-inspectable artifact in v0.1. Its schema is not a public
compatibility commitment.

`evidence/diagnosis-context.json` contains the non-secret, resolved diagnosis
inputs used for the run, including:

- flow ownership hints
- project-defined signature definitions
- redaction rule names and patterns
- diagnosis rule-set version

Sensitive environment values and hook-export values are never included.

`result.json` is the stable machine interface.

## Runner Result

`runner/result.json` contains MobTrace's normalized runner outcome plus
runner-specific metadata needed for forensic inspection.

It must include:

- runner name and detected version
- original runner exit code
- start, end, and duration
- journey status
- discovered runner artifact references

Runner-specific fields may appear below a namespaced object:

```json
{
  "runner": "maestro",
  "runnerVersion": "2.x",
  "exitCode": 1,
  "status": "failed",
  "maestro": {}
}
```

Only common fields are part of the v0.1 public contract.

## Hook Results

Hook directories use stable IDs:

- `project-prepare`
- `flow-prepare`
- `flow-cleanup`
- `project-cleanup`

Each `hooks/<hook-id>/result.json` includes:

```json
{
  "schemaVersion": 1,
  "id": "flow-cleanup",
  "phase": "cleanup",
  "scope": "flow",
  "status": "passed",
  "startedAt": "2026-06-11T10:16:17.100Z",
  "endedAt": "2026-06-11T10:16:18.000Z",
  "durationMs": 900,
  "exitCode": 0,
  "timedOut": false,
  "exportedEnvironmentKeys": [],
  "stdout": "hooks/flow-cleanup/stdout.log",
  "stderr": "hooks/flow-cleanup/stderr.log"
}
```

Exported environment values are never retained. Preparation results may list
exported key names.

## Source Metadata

`source/metadata.json` records:

- repository state
- full head and baseline commit IDs
- branch when available
- dirty state
- changed and untracked file counts
- source-control command versions used for collection

`source/changed-files.json` is an array:

```json
[
  {
    "path": "lib/features/auth/login_page.dart",
    "status": "modified",
    "staged": false,
    "unstaged": true
  },
  {
    "path": ".maestro/flows/login.yaml",
    "status": "untracked",
    "staged": false,
    "unstaged": false
  }
]
```

File status is one of:

- `added`
- `modified`
- `deleted`
- `renamed`
- `copied`
- `untracked`
- `type-changed`
- `unknown`

Renamed and copied entries may include `previousPath`.

`source/diff.patch` contains:

- baseline-to-HEAD changes
- staged working-tree changes
- unstaged working-tree changes
- synthetic unified diffs for readable untracked text files

Binary files are listed in `changed-files.json` but their contents are not
embedded.

Diff sections must be labeled so consumers can distinguish committed, staged,
unstaged, and untracked changes.

## Doctor Result

`mobtrace doctor --json` returns a separate stable object:

```json
{
  "schemaVersion": 1,
  "mobtraceVersion": "0.1.0",
  "generatedAt": "2026-06-11T10:10:00.000Z",
  "ready": false,
  "checks": [
    {
      "id": "project",
      "status": "passed",
      "summary": "Project root is available.",
      "remediation": null
    },
    {
      "id": "maestro",
      "status": "failed",
      "summary": "Maestro was not found on PATH.",
      "remediation": "Install Maestro and ensure `maestro` is available on PATH."
    }
  ]
}
```

Check status is one of:

- `passed`
- `failed`
- `skipped`

`ready` is `true` only when every required check passed. Skipped optional checks
do not make the result unready.

Check identifiers may be added. Consumers must handle unknown identifiers.

## Redaction And Sensitive Evidence

MobTrace distinguishes generated output from original evidence.

### Generated Output

These files must apply built-in and configured redaction:

- `result.json`
- `report.md`
- `mobtrace.log`
- normalized JSON evidence
- normalized runner and hook results

Known sensitive environment and hook-export values must not appear.

### Original Evidence

These files may contain project-controlled sensitive data:

- runner stdout and stderr
- hook stdout and stderr
- external runner artifacts
- device logs
- source diffs

MobTrace retains original evidence without claiming it is fully redacted.

Requirements:

- mark potentially sensitive files in the evidence index
- keep artifacts local by default
- create run directories with owner-only permissions where supported
- never upload artifacts in v0.1
- warn when a generated report references sensitive evidence

MobTrace cannot guarantee that arbitrary project logs or source diffs contain no
secrets.

## Report Regeneration

`mobtrace report` may regenerate `result.json` and `report.md`.

Regeneration:

- never executes hooks or the mobile journey
- reads retained run evidence and `evidence/diagnosis-context.json`
- applies the current MobTrace built-in diagnosis implementation to those
  retained project-owned inputs
- does not modify original runner, hook, source, or device evidence
- rewrites generated reports atomically
- records the MobTrace version used for regeneration

`result.json` includes:

```json
{
  "generatedAt": "2026-06-11T11:00:00.000Z",
  "generatedByVersion": "0.1.1",
  "sourceRunCompletedAt": "2026-06-11T10:16:20.000Z"
}
```

These generation fields are required even for the initial report.

Regeneration may change diagnosis when deterministic rules or signatures
change between MobTrace versions. Project-owned signatures and ownership hints
remain the retained run snapshot unless a future explicit override is defined.
Regeneration must not change retained lifecycle or journey facts.

If evidence is insufficient to regenerate a valid result, `report` fails
without deleting the last valid report.

## Latest Run Resolution

`latest` is selected by:

1. reading valid `run.json` files below the configured artifact root
2. ordering by `createdAt` descending
3. resolving ties by `runId` descending

File modification time is not used.

Partial runs are eligible for `latest`.

## Schema Versioning

Public JSON documents use:

```json
{
  "schemaVersion": 1
}
```

Rules:

- `schemaVersion` is an integer.
- Consumers must reject unsupported schema versions.
- Consumers must ignore unknown fields within a supported version.
- New optional fields and enum values may be added compatibly.
- Existing required fields may not be removed or change meaning.
- Breaking changes require a new schema version.

Machine consumers must handle unknown enum values defensively.

## Retention

MobTrace v0.1:

- does not automatically delete runs
- does not compress runs
- does not upload runs
- does not deduplicate artifacts

Users and projects may remove run directories through their own tooling.

A future retention command or policy requires a separate contract.

## Explicitly Deferred

The following are outside the v0.1 report and artifact contract:

- remote artifact storage
- artifact upload
- database-backed run history
- cross-project run indexes
- trend and reliability aggregation
- HTML reports
- SARIF output
- report signing or attestation
- artifact compression
- automatic retention or garbage collection
- binary diff inspection
- probabilistic confidence scores
- AI-generated diagnosis

## Acceptance Criteria

This contract is ready to accept when:

- journey and lifecycle failures cannot be confused
- a partial or interrupted run remains inspectable
- `verify --json` and `report --json` return the same stable result shape
- all public paths are portable and run-relative
- direct facts are separate from deterministic inference
- suspicious changes include auditable reasons
- generated reports do not contain known secret values
- original potentially sensitive evidence is clearly identified
- report regeneration never reruns project behavior
- consumers can evolve safely through schema versioning
