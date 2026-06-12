# MobTrace Product

Status: Draft

## Product Summary

MobTrace helps AI coding agents and mobile developers understand why a mobile
regression happened after a code change.

It turns a failed mobile journey into a concise, evidence-backed diagnosis:

- what failed
- which part of the system likely owns the failure
- which recent changes are most relevant
- what should be inspected next

MobTrace is not another mobile automation product. It adds regression
forensics and actionable context to mobile journeys that teams already run.

## Problem

AI coding agents can edit mobile applications, but they still struggle to
verify and debug real mobile behavior.

When a mobile journey fails, the available evidence is usually fragmented
across screenshots, logs, test output, and source changes. An agent or developer
must manually connect these pieces before they can decide whether the problem
belongs to:

- application code
- test expectations
- backend behavior
- test data
- device or environment setup

This creates slow feedback, unnecessary code changes, and low confidence in
agent-authored mobile work.

The central problem is not running the journey. The central problem is
understanding the failure in the context of the change that just happened.

## Target Users

### Primary Users

- AI coding agents implementing and verifying mobile changes
- mobile developers using AI-assisted development workflows

### Secondary Users

- reviewers evaluating agent-authored mobile changes
- teams maintaining repeatable mobile regression journeys
- developers diagnosing failures from local or automated test runs

## User Need

After a mobile change, the user needs a fast and trustworthy answer to:

> Did the important journey still work, and if not, where should I investigate?

The answer must be useful without requiring the user to manually reconstruct
the failure from raw artifacts.

## Value Proposition

MobTrace shortens the distance between:

> The mobile journey failed.

and:

> This is the likely failure area, this evidence supports it, and this is the
> next action to take.

It provides:

- one place to understand the outcome of a mobile journey
- failure ownership guidance before code is changed
- correlation between the failure and recent source changes
- retained evidence for humans and agents
- repeatable results that can be reviewed after the run

## Product Principles

### Evidence Before Guessing

Every diagnosis should be grounded in observable run evidence and source
changes. MobTrace should clearly distinguish facts from inference.

### Actionable Over Exhaustive

The first result should tell the user what matters most. Detailed evidence can
remain available without overwhelming the initial diagnosis.

### Deterministic By Default

The same evidence should produce the same classification and recommendation.
Core product value must not depend on probabilistic interpretation.

### Preserve Existing Workflows

Teams should not need to replace their existing mobile journeys to benefit from
MobTrace.

### Low Adoption Cost

A team with an existing mobile journey should receive useful results before
writing custom integration code.

### Project Knowledge Is Optional

Additional project context may improve diagnosis, but it must enhance the
default experience rather than become a prerequisite.

### Honest Uncertainty

When evidence is insufficient, MobTrace should report uncertainty instead of
presenting a guess as a root cause.

## Core Experience

The intended user experience is:

1. The user selects an existing mobile journey.
2. MobTrace observes the journey and recent code changes.
3. MobTrace retains the relevant evidence.
4. On success, the user receives a clear verification result.
5. On failure, the user receives a concise diagnosis and recommended next
   action.
6. The user can inspect the full evidence when deeper investigation is needed.

For an AI coding agent, the first result should be sufficient to decide whether
to inspect application code, test code, backend behavior, test data, or the
execution environment.

## Product Scope

### Initial Scope

- mobile regression journeys
- local developer and AI-agent workflows
- failure evidence collection
- failure-area classification
- correlation with recent code changes
- concise human-readable diagnosis
- structured results for agent consumption
- retained reports for later inspection

### Future Scope

Future expansion may include:

- broader mobile platform support
- richer change-to-failure correlation
- shared team baselines
- reliability and duration trends
- integrations with code review and development environments

Future scope must reinforce regression diagnosis rather than turn MobTrace into
a general automation platform.

## Out Of Scope

MobTrace will not:

- replace mobile test runners
- create a new mobile automation language
- autonomously explore an application
- guarantee the true root cause of every failure
- replace unit, integration, or end-to-end tests
- replace human product, usability, or security review
- become a generic AI testing platform
- require a hosted service for its core value

## Differentiation

Mobile test runners answer:

> Did the journey pass or fail?

MobTrace additionally answers:

> What failed, which area likely owns it, which recent changes matter, and what
> should be inspected next?

Its differentiation is the connection between runtime failure evidence and the
current code change.

## Success Criteria

MobTrace is useful when it consistently helps users:

- reach the correct investigation area faster than using raw test output
- avoid editing application code for test or infrastructure failures
- understand failures without opening every generated artifact
- reproduce and review mobile verification outcomes
- preserve recurring debugging knowledge outside individual memory

The product should continue only if its diagnosis is materially more useful
than a mobile runner's output viewed beside a source diff.

## Product Metrics

Early evaluation should focus on:

- percentage of failures assigned to the correct ownership area
- percentage of diagnoses that produce a useful next action
- time from failed journey to first relevant code inspection
- number of artifacts a user must open before taking action
- setup time for a project with existing mobile journeys
- rate of failures MobTrace cannot classify honestly
- repeated use by agents and developers after initial evaluation

## Kill Criteria

The product should be reconsidered if it becomes:

- a thin wrapper around a mobile test runner
- only a prettier report generator
- a collection of project-specific scripts
- a tool that requires extensive custom integration before providing value
- a source of confident but unreliable root-cause claims
- a general automation platform without a clear regression-forensics advantage

## Product Positioning

MobTrace is:

> Diff-aware mobile regression evidence and failure diagnosis for AI coding
> agents and mobile developers.

Short form:

> Run the journey. Understand the failure.
