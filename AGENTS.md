AGENTS.md

Project Overview

This project aims to develop an intelligent drone flight-path planning system for 3D reconstruction. The application will allow users to select geographic targets, configure drone camera acquisition parameters, and visualize planned flight paths in a 3D environment.

The project uses CesiumJS to display geographic environments, terrain, buildings, and drone-related visualizations.

Technology Stack

The project currently uses:

React: User interface development.

TypeScript: Application logic and type safety.

Vite: Development server and build tooling.

CesiumJS: 3D geographic visualization and mapping.

Resium: React integration for CesiumJS.

Tailwind CSS: UI styling.

npm: Package management and scripts.

Do not introduce additional dependencies unless they are absolutely necessary.

Development Guidelines

General Practices

Inspect the existing codebase before making changes.

Follow the existing project structure and coding conventions.

Prefer modifying existing components and utilities over creating duplicate implementations.

Keep changes focused on the task being addressed.

Avoid introducing unnecessary complexity or unrelated changes.

Use clear and descriptive names for variables, functions, and components.

Add comments when they help explain non-obvious logic.

TypeScript and React

Use TypeScript for application code.

Prefer explicit types where they improve readability and maintainability.

Follow existing React component and hook patterns.

Avoid using any unless there is a clear justification.

Keep components focused on their intended responsibilities.

CesiumJS

Use existing CesiumJS and Resium functionality where possible.

Follow the project's established coordinate-system conventions.

Be mindful of the distinction between geographic coordinates (longitude, latitude, and height) and Cartesian coordinates.

Use Cesium's built-in conversion utilities instead of implementing coordinate conversions manually.

Clearly document assumptions involving camera position, orientation, and coordinate systems.

Development Commands

Use the following commands from the project root:

npm install
npm run dev
npm run build
npm run typecheck

Before considering that a change is complete, run the relevant available checks and verify that the application still builds.

If a command is unavailable, inspect package.json rather than assuming it exists.

Git and Collaboration

Do not commit directly to the main branch.

Work on a separate feature or documentation branch.

Submit changes through pull requests.

Keep commits focused and use descriptive commit messages.

Do not modify another contributor's work unnecessarily.

Follow the project's CONTRIBUTING.md guidelines.

Security and Configuration

Never commit private credentials, API keys, or other secrets.

Do not expose or unnecessarily modify environment-specific configuration.

Preserve existing Cesium ion configuration unless the task specifically requires changes.

Do not commit generated build output, dependency directories, or other unnecessary artifacts.

Instructions for AI Coding Assistants

When assisting with this project:

Inspect relevant files before proposing or implementing changes.

Explain the intended changes before making substantial modifications.

Do not assume functionality exists without checking the codebase.

Do not rewrite large portions of the project when a smaller change is sufficient.

Preserve existing functionality unless the task explicitly requires changing it.

Identify assumptions, limitations, and potential side effects.

Run relevant build, type-checking, and testing commands after making changes.

Report which files were modified and whether the checks passed.

Ask for clarification when requirements are ambiguous rather than making major architectural decisions independently.

AI-generated code must be reviewed and understood by a project contributor before being merged.