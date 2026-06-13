# MobTrace Usage Guide

Status: Accepted

## Purpose

This guide shows the shortest path from an existing Maestro flow to a retained
MobTrace report.

MobTrace does not create mobile tests. It runs a flow you already own, keeps the
evidence local, and connects the failure to the current Git diff.

## Prerequisites

- Node.js 22.12 or newer
- npm 10 or newer
- Git
- Maestro installed and available on `PATH`
- at least one existing Maestro flow
- a connected emulator or device for real mobile execution

## Install

After publication:

```bash
npm install --save-dev mobtrace
npx mobtrace --help
```

From a local checkout:

```bash
npm ci
npm run build
node dist/cli.js --help
```

## Initialize A Project

Run this from the mobile project root:

```bash
npx mobtrace init
```

This creates:

- `mobtrace.yaml`
- `.gitignore` with `.mobtrace/`

MobTrace stores retained runs under `.mobtrace/runs` by default. Keep
`.mobtrace/` ignored; these artifacts are local evidence, not source.

## Configure A Flow

Edit `mobtrace.yaml` and point a named flow at an existing Maestro file:

```yaml
version: 1

flows:
  login:
    path: .maestro/flows/login.yaml
```

Then check the setup:

```bash
npx mobtrace doctor
```

## Run A Flow

```bash
npx mobtrace verify --flow login
```

With an explicit device:

```bash
npx mobtrace verify --flow login --device emulator-5554
```

MobTrace exits with the verification result. A failed mobile journey returns a
non-zero exit code, while retained reports stay available under `.mobtrace/runs`.

## Read The Result

Print the compact diagnosis:

```bash
npx mobtrace report latest
```

Print the full Markdown report:

```bash
npx mobtrace report latest --full
```

Print machine-readable JSON:

```bash
npx mobtrace report latest --json
```

Use an explicit run id or artifact directory when needed:

```bash
npx mobtrace report 20260613T030906Z-ede897 --full
npx mobtrace report .mobtrace/runs/20260613T030906Z-ede897 --json
```

## Hooks For Fixtures

If a flow needs app installation, backend fixture setup, or cleanup, declare
project-owned hooks:

```yaml
version: 1

flows:
  login:
    path: .maestro/flows/login.yaml
    hooks:
      prepare:
        command:
          - ./tool/prepare_login_fixture.sh
        timeout: 60s
      cleanup:
        command:
          - ./tool/cleanup_login_fixture.sh
        timeout: 60s
```

Preparation hooks can export environment values to Maestro by writing JSON to
`$MOBTRACE_HOOK_OUTPUT`:

```json
{
  "environment": {
    "APP_ID": "com.example.dev",
    "MAESTRO_TEST_EMAIL": "test@example.test"
  }
}
```

MobTrace passes exported values to Maestro as `-e KEY=VALUE`, redacts retained
runner command output, and makes the values available to cleanup hooks.

## Ownership Hints

Ownership hints bias suspicious-file ranking without declaring root cause:

```yaml
flows:
  login:
    path: .maestro/flows/login.yaml
    owns:
      - lib/features/auth/
      - lib/navigation/
```

Use ownership hints for stable code areas tied to a flow. Do not use them to
hide unrelated changes.

## Common Commands

```bash
npx mobtrace doctor
npx mobtrace verify --flow login
npx mobtrace verify --flow login --json
npx mobtrace report latest
npx mobtrace report latest --full
npx mobtrace report latest --json
```

## What To Commit

Commit:

- `mobtrace.yaml`
- project hook scripts
- `.gitignore` entry for `.mobtrace/`

Do not commit:

- `.mobtrace/`
- generated runner screenshots or logs
- local fixture secrets
