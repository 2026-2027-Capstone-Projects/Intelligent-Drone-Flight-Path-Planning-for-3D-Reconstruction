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

The drone's operating volume is made of boxes the user draws on the globe: flight zones, where the drone may fly, and no-flight zones, where it must not (see the next section). Planned waypoints (PBI-03) and exported missions (PBI-04) are checked against them. Every zone is a `BoundingBox`. The code is in `src/boundingBox.ts`.

- **Type:** `BoundingBox` is a plain object for a box that can be rotated: `centerLongitude`, `centerLatitude`, `width`, `depth`, `heading`, `minAltitude`, and `maxAltitude`. `boxCorners` returns its four corners in degrees.
- **Horizontal shape:** The center is WGS84 longitude and latitude in degrees. `width` and `depth` are meters in the local east-north-up plane at the center: `depth` runs along the heading and `width` across it. `heading` is degrees clockwise from north, wrapped into [0, 360). At heading 0 the box is north-aligned. All geometry is done in local meters, so boxes can cross the antimeridian.
- **Altitude:** Meters above ground level (AGL), measured from the terrain below the point. Callers of the containment checks must pass AGL heights, not ellipsoid or sea-level heights.
- **Altitude limit:** `MAX_ALTITUDE_AGL_M` is 120 m. FAA Part 107 allows 400 ft (121.92 m) AGL, and we round down for a small safety margin.
- **Edges:** Inclusive. A point on an edge (to within 1 mm), or exactly at the min or max altitude, is inside.
- **Meters to degrees:** Points are moved between degrees and local meters with Cesium's east-north-up frame (`Transforms.eastNorthUpToFixedFrame` and its inverse). Meters aren't converted to degrees by hand.
- **Validation:** `validateBoundingBox` checks that every field is a number, the center latitude is within ±90° and longitude within ±180°, the width and depth are greater than 0 m, and the altitudes are in order and in range. Invalid values are never passed to Cesium.
- **Containment:** `isInsideBoundingBox(box, longitude, latitude, height)` moves the point into the box center's east-north-up plane, turns it by the box's heading, and compares it with the half width and half depth. It then compares the AGL height with the altitude limits.
- **Display:** `BoundingBoxEntity` draws each zone as a translucent extruded polygon through its four corners, with both heights relative to the ground. Cesium offsets the whole volume by the terrain height at its center, so over sloped terrain the drawing is approximate. The containment checks are exact.

### Flight Zones and No-Flight Zones

The user draws **flight zones** (where the drone may fly) and **no-flight zones** (where it must not, such as neighboring buildings, roads, or restricted airspace). The **workable area** is the union of the flight zones minus the union of the no-flight zones. Planned paths should use the workable-area check. The code is in `src/boundingBox.ts` and `src/components/ZoneDrawTool.tsx`.

- **Model:** `FlightZones` holds two lists of `BoundingBox`: `flight` and `noFlight`. Every zone uses the conventions above: degrees, meters AGL, inclusive edges, and the 120 m altitude limit.
- **Drawing:** The panel's "Draw flight zone" and "Draw no-flight zone" buttons start draw mode. The user presses on the ground at one corner, drags to the opposite corner, and releases. A ground-clamped preview follows the cursor. The box's sides run along and across the camera's heading at the start of the drag, so its near and far edges run left to right on screen, like the drag. Looking straight down, the box matches the dragged screen rectangle exactly. Each drag creates at most one zone, then draw mode ends. Esc or the Cancel button stops drawing. Zones don't depend on the selected building.
- **Camera while drawing:** Left-drag rotation and panning (`screenSpaceCameraController.enableRotate` and `enableTranslate`) are turned off so the drag draws instead of moving the camera. Zoom and tilt still work. The previous settings are restored when drawing ends or is cancelled.
- **Picking the ground:** Corners come from `scene.globe.pick` on the camera's pick ray, so they land on the terrain and ignore buildings and the translucent zone volumes. The result is converted to degrees with `Cartographic.fromCartesian`.
- **From corners to a zone:** `zoneSpecFromCorners(kind, a, b, heading)` puts the far corner in the near corner's local plane and splits the diagonal into its parts along and across the heading. Those give the depth and width, and the midpoint gives the zone's anchor. The corners can be in any order (any drag direction). The width and depth are rounded to the centimeter and the heading to 0.01°, so the dragged points end up within a few millimeters of two opposite corners. `dragCorners` uses the same math for the preview.
- **Editing:** Each zone is then edited in meters (`ZoneSpec`): an east/north offset from the drawn center, a width and depth, a rotation in degrees clockwise from north, and a min/max altitude. `zoneFromSpec` converts it to a `BoundingBox`.
- **Defaults:** A new flight zone runs from 0 to 60 m AGL. A new no-flight zone runs from 0 to 120 m, so by default it blocks every altitude.
- **No-flight edges:** Inclusive, like flight zones. A point on a no-flight edge, or exactly at a no-flight zone's min or max altitude, is inside the no-flight zone and therefore not workable.
- **No-flight altitude:** A no-flight zone only blocks its own altitude band. A no-flight zone from 0 to 30 m inside a flight zone from 0 to 60 m still allows flight above 30 m.
- **Containment:** `isInsideWorkableArea(zones, longitude, latitude, height)` returns true when the point is inside at least one flight zone and inside no no-flight zone, using `isInsideBoundingBox` for each.
- **Workable ground area:** `workableGroundArea(zones)` returns the area in m² of the ground below which some altitude is still workable. A no-flight zone only removes ground where it blocks every altitude the flight zones allow there. Every zone's corners are placed in one local east-north-up plane centered on the first flight zone. The plane is cut into vertical slabs at every corner and at every point where two edges cross. Inside a slab no edges cross, so along a vertical line the workable length changes linearly. A piece of that line counts if its flight altitude bands, minus its no-flight bands, leave some height. The length measured at the slab's middle times the slab's width gives the slab's exact area. The flat local plane is accurate to well under 0.1% at site scale. The panel shows the total.
- **Validation:** A drag that starts or ends off the globe (for example on the sky), or is smaller than `MIN_DRAWN_ZONE_SIZE_M` (2 m) on a side, creates no zone and shows a red message in the panel. `zoneFromSpec` rejects non-numeric values, a width or depth of 0 m or less, or more than 2,000 m, and offsets beyond ±2,000 m. It then runs `validateBoundingBox` on the result. Invalid edits show a red message under that zone, and the last valid zone stays on the globe.
- **Warnings:** `zoneWarnings` adds an amber message when a no-flight zone doesn't overlap any flight zone in 3D (a separating-axis test on the rotated footprints, plus the altitude bands), or when the no-flight zones leave no workable area.
- **Display:** Flight zones are translucent green and no-flight zones translucent red. Clicks still reach buildings under the zones because the click handler uses `drillPick`.

## 3. Deployment Plan & Production Target

- **Target Environment:** The walking skeleton and web interface run hosted on the **OSU FLIP environment** (`flip1.engr.oregonstate.edu`).
- **Access & Hosting:** Served via the Vite development server on FLIP and reached from local developer setups through SSH tunnels (`-L 5173:localhost:5173`).
- **Preview Build:** `.github/workflows/CD.yml` publishes a static preview to GitHub Pages on each push to `main`. FLIP remains the primary target.
- **Infrastructure Ownership:** Maintained by the Capstone project team infrastructure leads on FLIP.
- **Agreement:** Reviewed and confirmed for Fall Checkpoint 1 baseline deliverables.

## 4. Decisions Deferred on Purpose

- **Live Hardware Telemetry:** Connecting directly to real drone hardware over MAVLink/PX4 is deferred to future iterations; current development focuses on pre-flight planning and offline simulation exports.
