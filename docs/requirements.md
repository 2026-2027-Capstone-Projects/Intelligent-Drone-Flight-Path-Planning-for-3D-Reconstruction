# Functional & System Requirements
**Project:** Intelligent Drone Flight Path Planning for 3D Reconstruction  
**Term:** Fall 2026 – Repo Checkpoint 1  

## 1. Overview & Problem Statement
Planning drone flight paths for 3D photogrammetry by hand is tedious and error-prone. Inconsistent image overlap, missing angles, and inaccurate camera pitch frequently lead to incomplete or distorted 3D surface models. Our goal is to build an automated web application that takes target geometric bounds and generates optimized 3D flight trajectories, waypoint sequences, and camera gimbal angles tailored for high-quality 3D reconstruction.

## 2. Functional Requirements
* **FR1 (Interactive Globe):** The system shall render an interactive 3D map interface using CesiumJS, enabling users to inspect terrain and designate target boundaries.
* **FR2 (Trajectory Generation):** The backend shall compute optimized flight trajectories (waypoints, speed, altitude profiles, and camera orientation vectors) based on user-defined coordinates.
* **FR3 (Visual Path Overlay):** The frontend shall display generated waypoints, path lines, and camera field-of-view vectors on top of the 3D map.
* **FR4 (Input Validation):** The backend shall validate incoming JSON payloads to ensure latitude, longitude, and altitude parameters stay within safe operational limits before processing.

## 3. Non-Functional Requirements
* **NFR1 (Response Latency):** Trajectory calculations for standard orbital paths (8 to 50 waypoints) must finish processing and display in under 500 ms.
* **NFR2 (Coordinate Precision):** Coordinate transformations between WGS84 geographic coordinates and local Cartesian/ENU frames must remain accurate within $\le 0.01$ meters.

## 4. Acceptance Criteria
* **AC1 (Automated Validation):** Coordinate conversion utility functions pass automated pytest suites in the CI pipeline on every pull request.
* **AC2 (UI Stability):** If invalid bounding box parameters are sent to the backend, the API returns a structured error response, and the frontend logs a clean warning rather than crashing the Cesium viewer.

## 5. Project Constraints
* **Licensing:** Core libraries (React, FastAPI, CesiumJS, NumPy) must use permissive open-source licenses (MIT, Apache 2.0, BSD).
* **Infrastructure Limits:** Deployment runs on OSU FLIP servers (`flip1`), requiring services to bind to unprivileged high ports ($>1024$) and use SSH port forwarding (`-L 5173:localhost:5173`).
* **External Assets:** Map imagery and terrain rely on public Cesium ion assets and open spatial data providers.
