# Technical Design & System Architecture

**Project:** Intelligent Drone Flight Path Planning for 3D Reconstruction

## 1. System Context & Architecture

We use a decoupled architecture to keep heavy geometric computations separate from user interface rendering:

- **Frontend:** Built with React, Vite, and CesiumJS (`vite-plugin-static-copy` serves Cesium's static assets). Handles the 3D globe visualization, user interaction, and waypoint overlay.
- **Backend (planned, not yet in this repository):** To be built with Python and FastAPI. Will execute array transformations, coordinate frame math, and path planning routines using NumPy/SciPy.

```text
+------------------------+  JSON API Request   +------------------------+
| React / CesiumJS       | ------------------> | FastAPI Backend        |
| Frontend Client        | <------------------ | Path Planning Engine   |
+------------------------+ Waypoints & Vectors +------------------------+
```

## 2. Data Model & Interfaces

- **API Payload:** The client sends target bounding parameters, desired altitude, and camera overlap ratios via REST endpoints.
- **Response Contract:** The server returns an ordered list of 3D coordinates $(x, y, z)$, waypoint sequence numbers, heading/gimbal angles, and path metadata.

### Operating Bounding Box

The operating bounding box is the 3D volume the drone must stay inside. Planned waypoints (PBI-03) and exported missions (PBI-04) are checked against it. The code is in `src/boundingBox.ts`.

- **Creation:** Clicking a building creates a box around it. There's no free-standing or manually placed box. Clearing the selection removes the box, and clicking another building moves it there.
- **Footprint:** Cesium OSM Buildings features carry a centroid and height but no footprint. The box therefore assumes a `ESTIMATED_FOOTPRINT_M` (30 m) square centered on the centroid. Large or long buildings can extend past this estimate.
- **Buffers:** The horizontal buffer is added to each of the four sides, and the vertical buffer is added above the roof. Both are in meters and adjustable in the panel, by typing or in 5 m steps. The defaults are 20 m horizontal and 10 m vertical. Neither can be negative, and the horizontal buffer can't exceed 200 m. The buffer stays the same when a different building is selected.
- **Meters to degrees:** Edges are found by offsetting from the centroid in a local east-north-up frame (`Transforms.eastNorthUpToFixedFrame`), then converting back to degrees with Cesium. Meters aren't converted to degrees by hand.
- **Type:** `BoundingBox` is a plain object with `west`, `south`, `east`, `north`, `minAltitude`, and `maxAltitude`. `toRectangle` converts it to a Cesium `Rectangle` when needed.
- **Horizontal bounds:** WGS84 longitude and latitude in degrees. The box can't cross the antimeridian, so `west` must be less than `east`.
- **Altitude:** Meters above ground level (AGL), measured from the terrain below the point. The box runs from 0 m up to the building height plus the vertical buffer. When `cesium#estimatedHeight` is missing, a 10 m height is assumed. Callers of the containment check must pass AGL heights, not ellipsoid or sea-level heights.
- **Altitude limit:** `MAX_ALTITUDE_AGL_M` is 120 m. FAA Part 107 allows 400 ft (121.92 m) AGL, and we round down for a small safety margin. The top is capped at this limit, and the panel says when the cap applies or when the building itself is taller than the limit.
- **Edges:** Inclusive. A point on an edge, or exactly at the min or max altitude, is inside.
- **Validation:** `validateBuffer` rejects buffers that are non-numeric, negative, or too large. `validateBoundingBox` checks the generated box: latitude within ±90°, longitude within ±180°, south less than north, west less than east, and altitudes in order and in range. Invalid values are never passed to Cesium. The panel shows the messages and keeps the last valid box on the globe.
- **Containment:** `isInsideBoundingBox(box, longitude, latitude, height)` uses Cesium's `Rectangle.contains` for the horizontal test, then compares the AGL height with the altitude limits.
- **Display:** `BoundingBoxEntity` draws a translucent cyan volume with both heights relative to the ground. Cesium offsets the whole volume by the terrain height at its center, so over sloped terrain the drawing is approximate. The containment check is exact. `BoundingBoxPanel` shows the buffer controls, the box size, and its bounds.

## 3. Deployment Plan & Production Target

- **Target Environment:** The walking skeleton and web interface run hosted on the **OSU FLIP environment** (`flip1.engr.oregonstate.edu`).
- **Access & Hosting:** Served via the Vite development server on FLIP and reached from local developer setups through SSH tunnels (`-L 5173:localhost:5173`).
- **Preview Build:** `.github/workflows/CD.yml` publishes a static preview to GitHub Pages on each push to `main`. FLIP remains the primary target.
- **Infrastructure Ownership:** Maintained by the Capstone project team infrastructure leads on FLIP.
- **Agreement:** Reviewed and confirmed for Fall Checkpoint 1 baseline deliverables.

## 4. Decisions Deferred on Purpose

- **Live Hardware Telemetry:** Connecting directly to real drone hardware over MAVLink/PX4 is deferred to future iterations; current development focuses on pre-flight planning and offline simulation exports.
