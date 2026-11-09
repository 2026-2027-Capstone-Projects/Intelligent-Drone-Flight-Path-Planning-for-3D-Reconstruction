# Contributing to Intelligent Drone Flight Path Planning for 3D Reconstruction

Each project member owns at least one piece of work per sprint, contributing to the fair distribution of work.

## Setup Steps

### Cloning This Repository

```bash
git clone https://github.com/2026-2027-Capstone-Projects/Intelligent-Drone-Flight-Path-Planning-for-3D-Reconstruction.git
```

See the [README](../../README.md) for the rest of the setup steps.

### Running Tests and Linting

There is no automated test suite yet. Run these checks from the project root before opening a pull request:

```bash
bun run check      # Lint and format check with Biome
bun run check:fix  # Apply Biome fixes
bun run typecheck  # Type-check with TypeScript
bun run build      # Type-check and build the app
```

_See CI Gate Implementation Plan Below_

## Definition of Done

### Required

- **Peer Review:** At least one other member gives a passing review (Enforced by GitHub branch protection).
- **Tests Pass:** Passes all unit and integration tests once a test suite exists (GitHub Actions currently runs linting and the build).
- **Documentation:** Documentation (README, diagrams, guides, etc.) is altered or generated and successfully reviewed by at least one other member.
- **Linting and Formatting:** Code adheres to project style guide without errors (Enforced by the `lint` job in GitHub Actions, which runs Biome).
- **Security:** No known vulnerabilities are introduced (Enforced by GitHub Dependabot).

### CI Gate Implementation Plan

| Gate/Check                   | Sprint | Owner              | Status                                  |
| ---------------------------- | ------ | ------------------ | --------------------------------------- |
| Pre-commit Hook              | 1      | Johnathon Rohweder | Not implemented                         |
| Automated Test Suite         | 1      | Johnathon Rohweder | Not implemented                         |
| GitHub Actions (test runner) | 1      | Aiden Kitchen      | Runs lint and build; no test runner yet |
| GitHub Dependabot            | 1      | Aiden Kitchen      | No `dependabot.yml` in this repository  |

## Where Work Lives

- **Code and documentation:** Tracked via pull requests in this repository.
- **Tasks:** Tracked in the Discord Server and via issues in this repository. See [Creating GitHub Issues and Draft Items](issues.md).

## What Accepted Means

- **Code:** Fulfills the Definition of Done and is successfully merged into the main branch.
- **Documentation:** Is successfully reviewed by the team and merged into the main branch.
- **Infrastructure/DevOps:** Implementation is verified to be working by the team.

## Making the Norm Workable

- **Task Sizing:** Tasks should be no larger than one sprint; features larger than one sprint should be broken down into multiple sub-tasks.
- **PR Review Turnaround:** 48 hours.
- **Pairing:** Tasks that were completed as a pair should list both members.
