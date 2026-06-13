# Technical Debt Tracker

This file records unresolved implementation debt discovered during active work.

Do not use it for speculative product ideas or accepted roadmap milestones.

## Open

| ID | Description | Source | Risk | Owner | Exit condition |
| --- | --- | --- | --- | --- | --- |
| M7-001 | Execute the full package and subprocess reliability baseline on a real macOS host. | Milestone 7 | medium | unassigned | A documented macOS runner completes `npm run verify:full`, interruption tests, and package smoke without platform-specific failures. |
| M8-001 | Improve diagnosis for compound failures where the journey fails and cleanup also fails. | Milestone 8 | medium | unassigned | Reports preserve journey failure as the primary investigation area while still surfacing cleanup failure as secondary lifecycle evidence. |

## Resolved

Move completed items here with the resolving commit or execution plan.

| ID | Description | Resolution |
| --- | --- | --- |
