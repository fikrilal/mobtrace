# MobTrace

MobTrace is a diff-aware mobile regression evidence and diagnosis CLI for AI
coding agents and mobile developers.

It runs an existing Maestro journey, captures local evidence, inspects the
current Git diff, and prints a deterministic diagnosis that points to the most
likely investigation area.

The project is experimental. Start at `docs/README.md` for full product,
contract, engineering, and execution-plan documentation.

## Requirements

- Node.js 22.12 or newer
- npm 10
- Git
- Maestro for real mobile journeys

## First Run

Install and inspect the CLI:

```bash
npm install
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
