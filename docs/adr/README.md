# Architecture Decision Records

ADRs record accepted architectural decisions and their consequences.

## When To Add An ADR

Add an ADR when changing:

- language, runtime, module system, or package manager
- major source layout or dependency direction
- public compatibility or schema versioning strategy
- runner integration boundary
- artifact persistence model
- deterministic diagnosis policy
- a major infrastructure or distribution dependency

Do not create an ADR for routine implementation choices already covered by an
accepted document.

## Lifecycle

1. Copy `docs/adr/template.md`.
2. Use the next four-digit number and a short title, for example
   `0001-short-decision.md`, under `docs/adr/`.
3. Set status to `Proposed`.
4. Review consequences and alternatives.
5. Mark it `Accepted` when the decision is adopted.
6. Never rewrite historical decisions to hide change.
7. Add a new ADR and mark the old one `Superseded` when replacing it.

## Index

No ADRs have been recorded yet.
