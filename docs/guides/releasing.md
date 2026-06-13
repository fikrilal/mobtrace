# Release Guide

Status: Accepted

## Purpose

This guide defines the manual release path for MobTrace v0.1.

Use it when publishing the npm package or cutting a public tag.

## Preconditions

- working tree is clean
- version in `package.json` is final
- `CHANGELOG.md` has the release entry
- `docs/engineering/release-checklist.md` reflects current evidence
- package contents are intentional
- npm account has publish permission for `mobtrace`

## Local Gate

Run:

```bash
npm run verify:full
```

Do not publish if this fails.

## Package Inspection

Run:

```bash
npm pack --dry-run --json
```

Confirm the package contains only intended public files:

- `README.md`
- `CHANGELOG.md`
- `dist/`
- `docs/README.md`
- `docs/contracts/`
- `docs/guides/`
- selected engineering/product docs
- `examples/`
- `package.json`

## Install Smoke

Create a temporary project and install the tarball:

```bash
npm pack
tmp="$(mktemp -d)"
cd "$tmp"
npm init -y
npm install --save-dev /path/to/mobtrace-0.1.0.tgz
npx mobtrace --help
npx mobtrace init
npx mobtrace doctor --json
```

Confirm:

- `mobtrace.yaml` is created
- `.gitignore` contains `.mobtrace/`
- `doctor` prints valid JSON

For a Git-worktree smoke:

```bash
git init
mkdir -p bin .maestro/flows
printf '#!/usr/bin/env sh\nexit 0\n' > bin/maestro
chmod +x bin/maestro
printf 'appId: test\n' > .maestro/flows/example.yaml
npx mobtrace init
npx mobtrace doctor --json
```

Confirm `doctor.ready=true` and the `gitignore` check passes.

## Publish

Authenticate:

```bash
npm login
npm whoami
```

Publish:

```bash
npm publish --access public
```

Do not use `--tag latest` differently from npm defaults unless intentionally
publishing a prerelease.

## Tag

After publish succeeds:

```bash
git tag v0.1.0
git push origin development --tags
```

If the Git remote uses another default branch, push the branch that contains the
release commit.

## Rollback

npm unpublish rules are time-limited and should not be part of normal release
strategy.

If a bad package is published:

1. publish a patch version with the fix
2. update `CHANGELOG.md`
3. tag the patch release

Prefer forward fixes over deleting published artifacts.
