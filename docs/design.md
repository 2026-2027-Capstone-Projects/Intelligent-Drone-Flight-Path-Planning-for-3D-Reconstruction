# Technical Design & System Architecture

**Project:** Intelligent Drone Flight Path Planning for 3D Reconstruction

## 1. System Context & Architecture

We use a decoupled architecture to keep heavy geometric computations separate from user interface rendering:
- **Frontend:** Built with React, Vite, and CesiumJS (`vite-plugin-cesium`). Handles the 3D globe visualization, user interaction, and waypoint overlay.
- **Backend:** Built with Python and FastAPI. Executes array transformations, coordinate frame math, and path planning routines using NumPy/SciPy.

+------------------------+ JSON API Request +------------------------+
| React / CesiumJS | -------------------------> | FastAPI Backend |
| Frontend Client | <------------------------- | Path Planning Engine |
+------------------------+ Waypoints & Vectors +------------------------+


## 2. Data Model & Interfaces

- **API Payload:** The client sends target bounding parameters, desired altitude, and camera overlap ratios via REST endpoints.
- **Response Contract:** The server returns an ordered list of 3D coordinates $(x, y, z)$, waypoint sequence numbers, heading/gimbal angles, and path metadata.

## 3. Deployment Plan & Production Target

- **Target Environment:** The walking skeleton and web interface run hosted on the **OSU FLIP environment** (`flip1.engr.oregonstate.edu`).
- **Access & Hosting:** Served via Vite development server bound to `0.0.0.0` with `allowedHosts: true` and proxied to local developer setups through SSH tunnels.
- **Infrastructure Ownership:** Maintained by the Capstone project team infrastructure leads on FLIP.
- **Agreement:** Reviewed and confirmed for Fall Checkpoint 1 baseline deliverables.

## 4. Decisions Deferred on Purpose

- **Live Hardware Telemetry:** Connecting directly to real drone hardware over MAVLink/PX4 is deferred to future iterations; current development focuses on pre-flight planning and offline simulation exports.
