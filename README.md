# MobTrace

MobTrace is a diff-aware mobile regression evidence and diagnosis CLI for AI
coding agents and mobile developers.

It runs an existing Maestro journey, captures local evidence, inspects the
current Git diff, and prints a deterministic diagnosis that points to the most
likely investigation area.

The project is experimental and preparing for public v0.1. Start at
`docs/README.md` for full product, contract, engineering, and execution-plan
documentation.

## Requirements

- Node.js 22.12 or newer
- npm 10
- Git
- Maestro for real mobile journeys

## First Run

Install from npm after publication:

```bash
npm install --save-dev mobtrace
npx mobtrace --help
```

For local development from this repository:

```bash
npm ci
npm run build
node dist/cli.js --help
```

Create a starter config in a mobile project:

```bash
mobtrace init
mobtrace doctor
```

`init` also creates or updates `.gitignore` with `.mobtrace/` so retained run
artifacts stay local. If you write the config manually, add this entry yourself:

```gitignore
.mobtrace/
```

Configure an existing Maestro flow in `mobtrace.yaml`:

```yaml
version: 1
flows:
  login:
    path: .maestro/flows/login.yaml
```

See `examples/minimal/mobtrace.yaml` for a slightly fuller starting point with
artifact and ownership hints.

Run and inspect:

```bash
mobtrace verify --flow login
mobtrace report latest --full
```

Machine-readable output is available with:

```bash
mobtrace verify --flow login --json
mobtrace report latest --json
```

## Why Not Raw Maestro?

Maestro tells you whether the flow passed and where the automation failed.
MobTrace keeps that evidence, then adds the missing debugging layer:

- failure class and ownership area
- source diff and changed-file correlation
- suspicious file ranking
- retained JSON and Markdown reports
- stable exit codes for agents and automation

MobTrace does not replace Maestro. It sits above an existing flow and helps an
agent or developer decide where to inspect first.

## Support And Limitations

- v0.1 is local-only: no artifact upload, telemetry, or hosted service.
- Linux is the current runtime-verified host baseline.
- macOS follows the POSIX code path but still needs real host runtime
  verification before it is described as runtime-verified.
- Windows is unsupported.
- Diagnosis is deterministic investigation guidance, not proof of root cause.
- Raw runner logs, source diffs, and device logs can contain sensitive project
  data. Generated reports are redacted, but raw evidence is retained locally
  and marked as sensitive.
- Retained artifacts default to `.mobtrace/runs`; keep `.mobtrace/` ignored in
  consuming projects.

## Development

Install dependencies:

```bash
npm ci
```

Run the canonical local verification:

```bash
npm run verify
```

For non-trivial changes, run the full local harness:

```bash
npm run verify:full
```

Build and invoke the CLI:

```bash
npm run build
node dist/cli.js --help
node dist/cli.js --version
```

Run the deterministic product validation fixture:

```bash
npm test -- test/product-validation.test.ts
```
