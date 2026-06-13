# MobTrace Configuration Contract

Status: Proposed

## Purpose

This document defines the MobTrace v0.1 project configuration contract.

It covers:

- configuration discovery and versioning
- path and override rules
- named flows
- Maestro runner settings
- lifecycle hooks
- environment and hook output handling
- ownership metadata
- signature and redaction references

It does not define the report schema or artifact contents. Those belong to the
report and artifact contract.

## Design Goals

Configuration should be:

- optional for a basic Maestro journey
- small enough to understand without specialist documentation
- strict and deterministic
- safe by default
- capable of expressing common setup and cleanup needs
- declarative rather than executable except at explicit hook boundaries

Configuration is not intended to become a general workflow language.

## File Format

The canonical configuration file is:

```text
mobtrace.yaml
```

The file uses YAML.

JSON configuration, multiple configuration fragments, and JavaScript or
TypeScript configuration files are outside v0.1.

## Discovery

Configuration is resolved in this order:

1. the path passed through `--config`
2. `<project-root>/mobtrace.yaml`
3. no configuration

MobTrace does not search parent directories beyond the resolved project root.

An explicit `--config` path must exist and be a regular file. When no
configuration is found, commands may continue if their arguments and defaults
provide enough information.

## Project Root

The project root is:

1. the path passed through `--project`
2. the current working directory

The project root is normalized to an absolute path before configuration is
loaded.

All relative paths in configuration are resolved against the project root, not
the configuration file's directory.

The project root does not need to equal the Git repository root, but v0.1
diff-aware analysis requires the project root to be inside a Git worktree.

## Versioning

Every configuration file must declare:

```yaml
version: 1
```

Rules:

- `version` is required.
- The value must be an integer.
- Unsupported versions fail configuration validation.
- MobTrace must not silently reinterpret an older or newer configuration.
- Additive fields may be introduced within version `1` only when old
  configurations retain their meaning.
- Breaking schema or behavior changes require a new configuration version.

## Top-Level Shape

The v0.1 top-level fields are:

```yaml
version: 1
artifacts: {}
defaults: {}
maestro: {}
environment: {}
hooks: {}
flows: {}
diagnosis: {}
```

Only `version` is required.

Unknown fields are errors at every schema level. This prevents misspellings
from being silently ignored.

## Minimal Configuration

A minimal named flow:

```yaml
version: 1

flows:
  login:
    path: .maestro/flows/login.yaml
```

Configuration is not required when the flow path is supplied directly:

```text
mobtrace verify --flow .maestro/flows/login.yaml
```

## Artifacts

Project-level artifact defaults:

```yaml
artifacts:
  root: .mobtrace/runs
```

### `artifacts.root`

- Type: non-empty path string
- Default: `.mobtrace/runs`
- Relative paths resolve from the project root.
- The directory may be created by MobTrace.
- The path must be writable before a run starts.
- When the artifact root is inside a Git worktree, the artifact root should be
  ignored by Git. `mobtrace init` adds `.mobtrace/` for the default artifact
  root, and `mobtrace doctor` warns when the resolved artifact root is not
  ignored.
- A CLI `--artifacts` value overrides the generated run location for that
  invocation.

Retention and deletion policies are deferred. MobTrace v0.1 does not
automatically delete completed runs.

## Defaults

Project-level execution defaults:

```yaml
defaults:
  device: emulator-5554
  baseline: origin/main
  timeout: 15m
```

All fields are optional.

### `defaults.device`

- Type: non-empty string
- Used when the selected flow does not define a device and `--device` is absent.
- The value is passed as an exact device identifier.

### `defaults.baseline`

- Type: non-empty Git revision string
- Used when the selected flow does not define a baseline and `--baseline` is
  absent.
- The revision must resolve before journey execution.

### `defaults.timeout`

- Type: duration string
- Applies to Maestro journey execution when the selected flow does not override
  it.
- No timeout is applied when omitted.

Supported duration units:

- `ms`
- `s`
- `m`
- `h`

Examples: `500ms`, `30s`, `15m`, `2h`.

Durations must be positive and contain one unit.

## Maestro Settings

Maestro is the only runner supported in v0.1.

Project-level runner settings:

```yaml
maestro:
  executable: maestro
```

### `maestro.executable`

- Type: non-empty string
- Default: `maestro`
- May be a command discoverable on `PATH` or a path to an executable.
- Relative executable paths resolve from the project root.

Arbitrary Maestro argument passthrough is intentionally unsupported in v0.1.
MobTrace owns runner invocation so it can preserve evidence and stable behavior.

## Named Flows

Named flows are declared as a map:

```yaml
flows:
  login:
    path: .maestro/flows/login.yaml
    device: emulator-5554
    baseline: origin/main
    timeout: 10m
    environment: {}
    hooks: {}
    owns: []
```

Flow names:

- must be unique
- must contain only lowercase letters, digits, and hyphens
- must begin with a lowercase letter
- must not exceed 64 characters

Valid examples:

- `login`
- `login-logout`
- `profile-update`

### `flows.<name>.path`

- Required for every named flow.
- Type: non-empty path string.
- May reference a Maestro YAML file or directory.
- Relative paths resolve from the project root.
- The path must exist before journey execution.

A directory is one MobTrace verification target even if Maestro executes
multiple files within it. The normalized run result represents the aggregate
runner outcome.

### `flows.<name>.device`

- Optional non-empty string.
- Overrides `defaults.device`.
- Is overridden by CLI `--device`.

### `flows.<name>.baseline`

- Optional non-empty Git revision string.
- Overrides `defaults.baseline`.
- Is overridden by CLI `--baseline`.

### `flows.<name>.timeout`

- Optional duration.
- Overrides `defaults.timeout`.

### `flows.<name>.environment`

- Optional environment additions for this flow.
- Merged over project-level `environment`.
- Uses the environment value contract defined below.

### `flows.<name>.hooks`

- Optional flow-specific preparation and cleanup hooks.
- Uses the lifecycle hook contract defined below.

### `flows.<name>.owns`

Optional source ownership hints:

```yaml
owns:
  - lib/features/auth/
  - lib/runtime/session/
  - .maestro/flows/auth/
```

Rules:

- Values are project-relative path prefixes.
- Paths do not need to exist at configuration load time.
- Ownership only biases suspicious-change ranking.
- Ownership must not exclude other changed files or declare a root cause.

## Environment Values

Project and flow environment values use the same shape:

```yaml
environment:
  API_URL:
    value: http://127.0.0.1:4000
  TEST_PASSWORD:
    fromEnv: MOBTRACE_TEST_PASSWORD
```

Each key must be a valid environment variable name:

```text
[A-Za-z_][A-Za-z0-9_]*
```

Keys beginning with `MOBTRACE_` are reserved and rejected in project
configuration and hook output.

Each value must contain exactly one of:

- `value`
- `fromEnv`

### Literal Values

```yaml
FEATURE_FLAG:
  value: enabled
```

Literal values must be strings. YAML numbers and booleans are rejected unless
quoted.

Configuration should not contain secrets. Literal values may be retained in run
metadata unless redacted.

### Environment References

```yaml
TEST_PASSWORD:
  fromEnv: MOBTRACE_TEST_PASSWORD
```

`fromEnv` names an environment variable from the MobTrace process.

Rules:

- The source variable must exist when the environment block is used.
- Its value is passed to the hook or runner under the configured target key.
- The value is treated as sensitive.
- The value must not be written into generated reports or command summaries.
- MobTrace does not support partial string interpolation such as
  `https://${HOST}/v1`.

This explicit form avoids accidental interpolation and makes secret sources
reviewable.

### Process Environment

External commands inherit the MobTrace process environment so standard tools
can resolve `PATH`, SDK locations, and platform configuration.

Configured environment entries are then applied as overrides.

MobTrace must not persist the complete inherited environment.

## Lifecycle Hooks

Hooks support project-specific preparation and cleanup without application
logic in MobTrace.

Project-level hooks:

```yaml
hooks:
  prepare:
    command: ["./tool/create-test-user"]
    timeout: 30s
  cleanup:
    command: ["./tool/delete-test-user"]
    timeout: 30s
```

Flow-level hooks use the same shape.

Only `prepare` and `cleanup` are supported in v0.1.

### Hook Command

`command` is a non-empty array of strings:

```yaml
command:
  - ./tool/create-test-user
  - --environment
  - dev
```

The first item is the executable. Remaining items are exact arguments.

MobTrace does not:

- split a string into shell words
- interpolate shell expressions
- expand globs
- evaluate pipes or redirects
- invoke a shell implicitly

A project that requires shell behavior must request it explicitly:

```yaml
command: ["bash", "-lc", "./tool/setup.sh && ./tool/check.sh"]
```

This makes shell usage visible during review.

Relative executable paths resolve from the project root. Hook working
directories are always the project root in v0.1.

### Hook Timeout

`timeout` is optional and uses the duration format defined above.

Defaults:

- preparation: `60s`
- cleanup: `60s`

A timed-out hook is terminated and recorded as a hook failure.

### Hook Environment

A hook receives:

1. the inherited MobTrace process environment
2. project-level configured environment
3. flow-level configured environment
4. values exported by completed preparation hooks
5. MobTrace context variables

Later sources override earlier sources except MobTrace context variables, which
cannot be overridden by configuration or hook output.

### MobTrace Context Variables

Hooks receive:

```text
MOBTRACE_RUN_ID
MOBTRACE_PROJECT_ROOT
MOBTRACE_ARTIFACTS_DIR
MOBTRACE_FLOW_NAME
MOBTRACE_FLOW_PATH
MOBTRACE_HOOK_PHASE
MOBTRACE_HOOK_OUTPUT
MOBTRACE_JOURNEY_STATUS
```

Rules:

- Paths are absolute.
- `MOBTRACE_FLOW_NAME` is empty for a direct path without a configured name.
- `MOBTRACE_HOOK_PHASE` is `prepare` or `cleanup`.
- `MOBTRACE_JOURNEY_STATUS` is empty during preparation.
- During cleanup, journey status is `passed`, `failed`, `not-run`, or
  `interrupted`.
- `MOBTRACE_HOOK_OUTPUT` points to a temporary file for the hook output protocol.

## Hook Composition

When both project-level and flow-level hooks exist, execution order is:

### Preparation

1. project preparation
2. flow preparation

### Cleanup

1. flow cleanup
2. project cleanup

Cleanup reverses preparation order.

MobTrace attempts all applicable cleanup hooks even when an earlier cleanup
hook fails. All cleanup outcomes are retained.

After journey execution is attempted, configured cleanup hooks are applicable
even when no matching preparation hook exists.

After preparation failure, cleanup unwinds only the levels that were entered:

- project cleanup is attempted if project preparation started
- flow cleanup is attempted if flow preparation started

This prevents cleanup for a narrower scope from running before its preparation
phase was reached.

## Hook Output Protocol

Preparation hooks may pass run-scoped values to later preparation hooks, the
Maestro process, and cleanup hooks.

The preparation hook writes one JSON object to the path provided in
`MOBTRACE_HOOK_OUTPUT`:

```json
{
  "environment": {
    "FIXTURE_EMAIL": "run-123@example.test",
    "FIXTURE_PASSWORD": "secret"
  }
}
```

Rules:

- Writing the file is optional.
- An absent or empty file means no exported values.
- The file must contain exactly one JSON object.
- Only the `environment` field is supported in v0.1.
- Environment keys follow the environment variable naming rule.
- Environment values must be strings.
- Unknown fields are errors.
- Exported values cannot override MobTrace context variables.
- All exported values are treated as sensitive.
- The output file is created outside retained artifacts with owner-only
  permissions where the operating system supports them.
- MobTrace reads and removes the temporary output file after the hook exits.
- Exported values are retained in process memory only for the remaining run.
- Generated reports may include exported key names but never values.

Cleanup hooks cannot export new values. If a cleanup hook writes to
`MOBTRACE_HOOK_OUTPUT`, MobTrace removes the file without consuming it.

The hook's standard output and standard error remain ordinary diagnostic
evidence and are not parsed as structured output.

## Hook Failure Behavior

### Preparation Failure

A non-zero exit, timeout, invalid output, or launch failure:

- prevents journey execution
- records a preparation failure
- triggers applicable cleanup when safe
- maps to the infrastructure or preparation CLI outcome

### Cleanup Failure

A non-zero exit, timeout, invalid output, or launch failure:

- does not erase the journey outcome
- records a cleanup failure
- allows remaining cleanup hooks to run
- affects the final exit code according to the CLI contract

Hook original exit codes are retained in run evidence.

## Diagnosis Settings

Optional diagnosis configuration:

```yaml
diagnosis:
  signatures:
    - .mobtrace/signatures.json
  redact:
    environment:
      - API_TOKEN
    patterns:
      - name: bearer-token
        regex: 'bearer\s+[a-z0-9._-]+'
        flags: i
```

### `diagnosis.signatures`

- Type: list of file paths.
- Relative paths resolve from the project root.
- Files must exist and be readable.
- Signature files are evaluated in listed order.
- Duplicate signature identifiers are configuration errors.

The signature file schema belongs to the report and diagnosis contract.

### `diagnosis.redact.environment`

- Type: list of environment variable names.
- Values of named variables are redacted from displayed runner and hook output
  when present.
- Variables referenced through `fromEnv` and values exported by hooks are
  automatically treated as sensitive and do not need to be listed.

### `diagnosis.redact.patterns`

Each pattern contains:

- `name`: unique lowercase identifier using letters, digits, and hyphens
- `regex`: regular expression string
- `flags`: optional regular expression flags

Rules:

- Patterns are applied to displayed and generated textual reports.
- Regular expressions use ECMAScript syntax.
- Supported user flags are `i`, `m`, `s`, and `u`.
- Duplicate and unsupported flags are configuration errors.
- MobTrace replaces every match regardless of whether `g` is specified, so
  the `g` flag is not accepted.
- Invalid regular expressions fail configuration validation.
- Patterns must replace matched values with a redaction marker.
- Pattern order is the declared list order.
- Redaction does not modify the consuming project's original source files.

Treatment of retained raw evidence belongs to the artifact contract.

## Precedence

Values are resolved from lowest to highest precedence:

1. MobTrace built-in defaults
2. project-level configuration
3. selected flow configuration
4. CLI options

Environment additions are resolved separately:

1. inherited process environment
2. project-level `environment`
3. flow-level `environment`
4. preparation hook exports
5. reserved MobTrace context variables

A higher-precedence scalar replaces a lower-precedence scalar. Maps are merged
by key. Lists replace lower-precedence lists unless a field explicitly defines
composition, such as project and flow hooks.

MobTrace should expose the resolved non-sensitive configuration in verbose
diagnostics and run metadata.

## Validation Timing

Static configuration validation occurs before any hook or runner command is
executed.

Static validation includes:

- schema and unknown fields
- configuration version
- flow names
- path syntax
- duration syntax
- command array shape
- environment entry shape
- reserved environment keys
- redaction regex syntax

Runtime validation includes:

- path existence
- executable availability
- environment reference availability
- Git revision resolution
- device availability
- artifact directory writability

`doctor` performs applicable runtime validation without executing preparation,
cleanup, or the mobile journey.

## Complete Example

```yaml
version: 1

artifacts:
  root: .mobtrace/runs

defaults:
  baseline: origin/main
  timeout: 15m

maestro:
  executable: maestro

environment:
  API_URL:
    value: http://127.0.0.1:4000
  FIXTURE_ADMIN_TOKEN:
    fromEnv: MOBTRACE_FIXTURE_ADMIN_TOKEN

hooks:
  prepare:
    command: ["./tool/check-backend"]
    timeout: 10s
  cleanup:
    command: ["./tool/cleanup-run"]
    timeout: 30s

flows:
  login:
    path: .maestro/flows/login.yaml
    owns:
      - lib/features/auth/
      - lib/runtime/session/

  profile-update:
    path: .maestro/flows/profile_update.yaml
    device: emulator-5554
    timeout: 10m
    hooks:
      prepare:
        command: ["./tool/create-profile-fixture"]
        timeout: 30s
      cleanup:
        command: ["./tool/delete-profile-fixture"]
        timeout: 30s
    owns:
      - lib/features/profile/
      - lib/runtime/user-context/

diagnosis:
  signatures:
    - .mobtrace/signatures.json
  redact:
    environment:
      - FIXTURE_ADMIN_TOKEN
    patterns:
      - name: bearer-token
        regex: 'bearer\s+[a-z0-9._-]+'
        flags: i
```

## Compatibility Policy

Once configuration version `1` is released:

- existing valid files must retain their meaning within the same major MobTrace
  release
- new optional fields may be added
- new required fields may not be added to version `1`
- existing fields may not change type or meaning
- unknown fields remain errors
- breaking changes require a new configuration version

Deprecations should produce actionable warnings before removal in a future
major release.

## Explicitly Deferred

The following are outside configuration version `1`:

- configuration imports or inheritance
- multiple configuration files
- profiles or named environments
- conditional execution
- loops, dependencies, or workflow graphs
- inline JavaScript or TypeScript
- implicit shell commands
- in-process plugins
- custom runner adapters
- remote secret providers
- automatic retention policies
- Windows-specific command variants

## Acceptance Criteria

This contract is ready to accept when:

- a direct Maestro flow works without configuration
- a named flow requires only `version`, `flows`, and `path`
- project-specific fixture setup can be expressed through hooks
- preparation can securely pass run-scoped values to Maestro and cleanup
- command execution does not require implicit shell parsing
- precedence and path resolution are unambiguous
- secrets are not required in committed configuration
- invalid or misspelled fields fail before external commands run
