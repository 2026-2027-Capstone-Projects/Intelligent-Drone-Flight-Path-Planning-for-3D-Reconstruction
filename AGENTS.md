# AGENTS.md

## Project Overview

This project aims to develop an intelligent drone flight-path planning system for 3D reconstruction. The application will allow users to select geographic targets, configure drone camera acquisition parameters, and visualize planned flight paths in a 3D environment.

The project uses CesiumJS to display geographic environments, terrain, buildings, and drone-related visualizations.

## Project Documentation

Read `README.md` and the relevant pages in `docs/` for more information about the project before planning or making changes:

- **`docs/architecture/design.md`:** System architecture, data model and interfaces, and deployment plan.
- **`docs/planning/requirements.md`:** Functional and non-functional requirements, acceptance criteria, and project constraints.
- **`docs/planning/risks.md`:** Risk register and external prerequisites.
- **`docs/process/contributing.md`:** Setup, definition of done, where work lives, and team norms.
- **`docs/process/issues.md`:** How to write GitHub Issues and Draft Items, including titles, tasks, and acceptance criteria.

If a page disagrees with the code, treat the code as correct and point out the mismatch.

## Technology Stack

The project currently uses:

- **React:** User interface development.
- **TypeScript:** Application logic and type safety.
- **Vite:** Development server and build tooling.
- **CesiumJS:** 3D geographic visualization and mapping.
- **Resium:** React integration for CesiumJS.
- **Tailwind CSS:** UI styling.
- **Bun:** Package management and scripts.
- **Biome:** Linting and formatting.

Do not introduce additional dependencies unless they are absolutely necessary.

## Development Guidelines

### General Practices

- Inspect the existing codebase before making changes.
- Follow the existing project structure and coding conventions.
- Prefer modifying existing components and utilities over creating duplicate implementations.
- Keep changes focused on the task being addressed.
- Avoid introducing unnecessary complexity or unrelated changes.
- Use clear and descriptive names for variables, functions, and components.
- Add comments when they help explain non-obvious logic.

### TypeScript and React

- Use TypeScript for application code.
- Prefer explicit types where they improve readability and maintainability.
- Follow existing React component and hook patterns.
- Avoid using `any` unless there is a clear justification.
- Keep components focused on their intended responsibilities.

### CesiumJS

- Use existing CesiumJS and Resium functionality where possible.
- Follow the project's established coordinate-system conventions.
- Be mindful of the distinction between geographic coordinates (longitude, latitude, and height) and Cartesian coordinates.
- Use Cesium's built-in conversion utilities instead of implementing coordinate conversions manually.
- Clearly document assumptions involving camera position, orientation, and coordinate systems.

## Development Commands

Use the following commands from the project root:

```bash
bun install
bun run dev
bun run build
bun run typecheck
bun run check
```

Before considering that a change is complete, run the relevant available checks and verify that the application still builds.

If a command is unavailable, inspect `package.json` rather than assuming it exists.

## Git and Collaboration

- Do not commit directly to the main branch.
- Work on a separate feature or documentation branch.
- Submit changes through pull requests.
- Keep commits focused and use descriptive commit messages.
- Do not modify another contributor's work unnecessarily.
- Follow the project's guidelines in `docs/process/contributing.md`.

## Security and Configuration

- Never commit private credentials, API keys, or other secrets.
- Do not expose or unnecessarily modify environment-specific configuration.
- Preserve existing Cesium ion configuration unless the task specifically requires changes.
- Do not commit generated build output, dependency directories, or other unnecessary artifacts.

## Instructions for AI Coding Assistants

When assisting with this project:

- Inspect relevant files before proposing or implementing changes.
- Explain the intended changes before making substantial modifications.
- Do not assume functionality exists without checking the codebase.
- Do not rewrite large portions of the project when a smaller change is sufficient.
- Preserve existing functionality unless the task explicitly requires changing it.
- Identify assumptions, limitations, and potential side effects.
- Run relevant build, type-checking, and testing commands after making changes.
- Report which files were modified and whether the checks passed.
- Ask for clarification when requirements are ambiguous rather than making major architectural decisions independently.
- AI-generated code must be reviewed and understood by a project contributor before being merged.

## Keeping Documentation Up to Date

Update this file in the same change whenever something it describes changes, including:

- The technology stack, such as adding, removing, or replacing a dependency or tool.
- The development commands or project scripts.
- The location or purpose of a page in `docs/`, or a new page being added.
- Any convention or workflow described here.

When editing this file, check that the rest of it still agrees with the change.

Update `README.md` and the relevant pages in `docs/` in the same change whenever a change to the repository affects something they describe, such as setup, requirements, architecture, deployment, risks, or team process.
