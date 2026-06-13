# Changelog

## 0.1.0 - 2026-06-13

Initial public release candidate.

### Added

- `mobtrace init`, `doctor`, `verify`, and `report`.
- Local artifact store with run manifests, normalized evidence, JSON reports,
  and Markdown reports.
- Maestro runner integration through existing flow files.
- Git diff and changed-file evidence collection.
- Optional prepare and cleanup hooks.
- Deterministic failure classification, failure-domain classification,
  suspicious changed-file ranking, flow ownership hints, and known signatures.
- Generated-output redaction with sensitive raw-evidence markings.
- Bounded subprocess output, timeout handling, interruption handling, and
  partial-run reportability.
- Deterministic product validation fixture and package smoke verification.

### Known Limitations

- v0.1 is local-only and does not upload artifacts or provide telemetry.
- Linux is the only runtime-verified host in the current repository evidence.
- macOS follows the POSIX code path but still needs real host runtime
  verification before being claimed as runtime-verified.
- Windows is unsupported.
- Diagnosis is deterministic investigation guidance, not automatic root-cause
  proof.
- Real mobile value still depends on stable project-owned Maestro flows and
  fixtures.
