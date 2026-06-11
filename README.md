# MobTrace

MobTrace is a diff-aware mobile regression evidence and diagnosis CLI for
coding agents.

The project is experimental. Its public behavior is being developed from the
contracts in `docs/`.

## Requirements

- Node.js 22.12 or newer
- npm 10

## Development

Install dependencies:

```bash
npm ci
```

Run the complete local verification:

```bash
npm run verify
```

Build and invoke the CLI:

```bash
npm run build
node dist/cli.js --help
node dist/cli.js --version
```

Milestone 0 intentionally implements only the CLI foundation. Maestro
execution, configuration, reports, and diagnosis are not implemented yet.
