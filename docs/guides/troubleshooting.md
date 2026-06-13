# Troubleshooting

Status: Accepted

## Purpose

This guide maps common MobTrace failures to the first thing to inspect.

## `doctor` Says Maestro Is Missing

Install Maestro and make sure the executable is on `PATH`:

```bash
maestro --version
npx mobtrace doctor
```

If your project uses a non-standard executable path, configure it:

```yaml
version: 1
maestro:
  executable: ./tool/maestro
```

## Device Is Not Ready

Typical diagnosis:

```text
Class: device-not-ready
Domain: infrastructure
```

Check the device list:

```bash
adb devices
```

Then rerun with the exact device id:

```bash
npx mobtrace verify --flow login --device emulator-5554
```

This is infrastructure evidence. Do not start by editing app code.

## Flow Cannot Find `${APP_ID}` Or Fixture Variables

If Maestro output says an app or variable is undefined, the flow probably needs
environment values.

For static values:

```yaml
flows:
  login:
    path: .maestro/flows/login.yaml
    environment:
      APP_ID:
        value: com.example.dev
```

For run-scoped values, use a prepare hook that writes to
`$MOBTRACE_HOOK_OUTPUT`:

```json
{
  "environment": {
    "APP_ID": "com.example.dev"
  }
}
```

MobTrace passes configured and hook-exported values to Maestro as `-e`.

## Backend Fixture Setup Fails

Typical diagnosis:

```text
Outcome: preparation-failed
Class: fixture-setup-failed
```

Inspect:

- `.mobtrace/runs/<run>/hooks/flow-prepare/stdout.log`
- `.mobtrace/runs/<run>/hooks/flow-prepare/stderr.log`
- backend availability and fixture endpoint status

This is usually test harness or backend setup, not the mobile screen under test.

## Cleanup Fails After A Journey

MobTrace preserves both outcomes:

- the journey result remains visible
- cleanup hook evidence is retained separately
- exit status reflects the configured precedence

Inspect cleanup evidence:

```bash
npx mobtrace report latest --full
```

Then open:

- `.mobtrace/runs/<run>/hooks/flow-cleanup/stdout.log`
- `.mobtrace/runs/<run>/hooks/flow-cleanup/stderr.log`

## `.mobtrace/` Shows Up In `git status`

Add this to `.gitignore`:

```gitignore
.mobtrace/
```

`mobtrace init` creates or updates this entry automatically. `doctor` warns when
the artifact root is inside a Git worktree and not ignored.

## Suspicious Files Look Wrong

MobTrace ranks changed files deterministically. It is investigation guidance,
not proof of root cause.

Check:

- whether your baseline is what you expect
- whether generated artifacts are ignored
- whether the flow has useful `owns` metadata
- whether the failure domain is infrastructure, backend, app, or test harness

Run with an explicit baseline when needed:

```bash
npx mobtrace verify --flow login --baseline origin/main
```

## Reports Might Contain Sensitive Evidence

MobTrace redacts generated reports and retained runner command streams where it
knows the secret values. Raw project-controlled evidence such as source diffs,
device logs, screenshots, and external runner artifacts can still contain
sensitive data.

Rules:

- keep `.mobtrace/` local
- do not upload artifacts unless you have reviewed them
- configure redaction for project-specific patterns
- avoid putting secrets directly in `mobtrace.yaml`
