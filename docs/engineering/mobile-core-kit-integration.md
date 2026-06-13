# mobile-core-kit Reference Integration

Status: Accepted

## Purpose

This document describes how `mobile-core-kit` should dogfood MobTrace without
turning MobTrace core into a project-specific wrapper.

## Integration Rule

`mobile-core-kit` owns project behavior:

- backend startup and readiness
- fixture user creation and cleanup
- emulator/device choice
- Flutter build flavor
- Maestro flow files
- project-specific selectors and test identities

MobTrace owns generic behavior:

- command execution
- Git source evidence
- hook lifecycle
- report generation
- deterministic diagnosis
- sensitive evidence marking

No `mobile-core-kit` path, endpoint, account, or shell script should be baked
into MobTrace core.

## Recommended Local Setup

From the `mobile-core-kit` repository, use the local MobTrace package during
dogfood:

```bash
npm install --no-save /home/fikrilal/devs/personal/mobtrace
npx mobtrace doctor
```

Configure flows in `mobtrace.yaml` with project-owned hooks. Example:

```yaml
version: 1
maestro:
  executable: maestro
artifacts:
  root: _artifacts/mobtrace
defaults:
  baseline: HEAD
flows:
  login-logout:
    path: .maestro/flows/auth/login_logout.yaml
    device: emulator-5554
    owns:
      - lib/features/auth/
      - lib/core/runtime/session/
      - lib/navigation/
    hooks:
      prepare:
        command: ["./tool/mobile/prepare_login_logout.sh"]
      cleanup:
        command: ["./tool/mobile/cleanup_login_logout.sh"]
```

Run:

```bash
npx mobtrace verify --flow login-logout --json
npx mobtrace report latest --full
```

## Reference Flows

Use existing stable flows first:

- login/logout
- active sessions
- profile update
- profile picture update

For each flow, record the product metrics from
`docs/engineering/product-validation.md`.

## Failure Injection

Validate MobTrace by intentionally creating reversible local changes:

- change a Maestro selector and confirm `test-harness`
- change navigation/session code and confirm `application`
- change auth payload/endpoint mapping and confirm `backend`
- stop or disconnect the selected emulator and confirm `infrastructure`
- make prepare cleanup fail and confirm lifecycle evidence remains inspectable

Use a temporary branch or throwaway working tree. Do not commit injected
failures.

## Acceptance For Dogfood

The integration is useful when:

- normal flows need no MobTrace core changes
- failed runs print a useful first diagnosis to stdout
- `result.json` is enough for an agent to pick the first investigation area
- `report --full` gives enough evidence for human review
- cleanup failures and backend fixture problems do not push agents toward app
  code by default
