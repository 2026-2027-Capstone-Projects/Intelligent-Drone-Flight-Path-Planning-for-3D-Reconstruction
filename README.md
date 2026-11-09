# Intelligent Drone Flight Path Planning for 3D Reconstruction

## Overview

A web-based application designed for intelligent flight path planning to support 3D reconstruction workflows using drone imagery and geospatial data.

---

## Current Status

The frontend currently provides:

- A CesiumJS viewer over Corvallis, Oregon, with world terrain and OSM 3D buildings.
- Building selection, with a highlight and an information panel.
- A line from a fixed drone position to the selected building, with the drone orientation calculated to face it.
- A readout of the viewer camera and drone camera position and orientation.

Flight path generation and the planned backend are not built yet.

---

## Prerequisites

Ensure you have the following installed on your system or development environment (e.g., OSU FLIP server or local machine):

- **Bun**
- **Node.js** (`^20.19.0` or `>=22.12.0`, as required by Vite)
- A free [Cesium ion access token](https://ion.cesium.com/tokens)

---

## Quickstart Guide

Follow these steps to set up and run the development environment from a clean clone:

1. **Clone the repository:**

   ```bash
   git clone https://github.com/2026-2027-Capstone-Projects/Intelligent-Drone-Flight-Path-Planning-for-3D-Reconstruction.git
   cd Intelligent-Drone-Flight-Path-Planning-for-3D-Reconstruction
   ```

2. **Install dependencies:**

   ```bash
   bun install
   ```

3. **Add your Cesium ion token:**

   ```bash
   cp .env.example .env
   ```

   Set `VITE_CESIUM_ION_TOKEN` in `.env`. Terrain and 3D buildings won't load without it.

4. **Start the development server:**

   ```bash
   bun run dev
   ```

   Open <http://localhost:5173> in your browser.

---

## Scripts

| Command             | Description                                |
| ------------------- | ------------------------------------------ |
| `bun run dev`       | Start the Vite development server.         |
| `bun run build`     | Type-check and build the app into `dist/`. |
| `bun run preview`   | Serve the production build locally.        |
| `bun run typecheck` | Type-check with TypeScript.                |
| `bun run check`     | Check linting and formatting with Biome.   |
| `bun run check:fix` | Apply Biome lint and formatting fixes.     |

---

## Project Structure

```text
.
├── .github/workflows/  CI and CD pipelines
├── docs/
│   ├── architecture/   System design
│   ├── planning/       Requirements and risks
│   └── process/        Contributing and issue guides
└── src/
    ├── components/     Cesium viewer and building info panel
    ├── App.tsx         Root component
    ├── cesiumIon.ts    Cesium ion token setup
    └── main.tsx        Application entry point
```

---

## Deployment

- **OSU FLIP (primary):** The app runs on the Vite development server on FLIP and is reached through an SSH tunnel (`-L 5173:localhost:5173`).
- **GitHub Pages (preview):** `.github/workflows/CD.yml` builds and publishes a static preview on each push to `main`, using the `VITE_CESIUM_ION_TOKEN` repository secret.

Pull requests to `main` run the CI workflow, which checks linting and formatting and builds the app.

---

## Documentation

- [System design](docs/architecture/design.md)
- [Requirements](docs/planning/requirements.md)
- [Risks](docs/planning/risks.md)
- [Contributing guide](docs/process/contributing.md)
- [Creating GitHub Issues and Draft Items](docs/process/issues.md)
