# PBI-03 (#38): Orbit planner verification

Recorded November 13, 2026. This change builds on the operating bounding box in PR #42 (`issue-35-bounding-box`, commit `8880774`). The orbital implementation is on `codex/issue-38-orbital-flight-path`.

## Acceptance evidence

| Criterion                                           | Evidence                                                                                                                                                                                                                                                     | Result                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| AC-01: N ordered waypoints, all fields              | `tests/orbit.test.ts` checks every count from 8 through 50 at latitudes 44.564°, −33.87°, and 80°: 129 orbits, 3,741 waypoints. Finite values, sequence, heading/pitch ranges, ENU spacing, and altitude are checked.                                        | Passed                             |
| AC-02: containment                                  | Every generated waypoint uses the existing `isInsideBoundingBox`; tests check horizontal/vertical rejection and inclusive box edges.                                                                                                                         | Passed                             |
| AC-03: camera points at target within 1°            | Independent geodesic bearings in unit tests, full 3D camera-ray reconstruction over sloping terrain, and real Cesium `Camera.setView` checks in the browser. Maximum browser camera-ray error was less than 0.000000001° for all three counts.               | Passed                             |
| AC-04: generation and display under 500 ms          | The production handler measures through the next Cesium `postRender`. The browser suite checks every recorded time against 500 ms. See the measurements below.                                                                                               | Passed in the recorded environment |
| AC-05: previous path removed                        | Browser checks actual primitive collections after every generation: exactly N points and one line, including changing 50 to 8 points. Changing the box clears the overlay. `OrbitDisplay` owns and destroys only its overlay resources.                      | Passed                             |
| AC-06: invalid fit or missing target does not crash | Browser checks overflow, missing target, invalid inputs, missing loaded terrain, and successful regeneration on the same viewer afterward; no uncaught page errors. Unit tests also cover invalid boxes/targets and missing terrain at individual waypoints. | Passed in the offline fixture      |

## Generation-through-display measurements

Environment: macOS arm64 host; headless Opera GX / Chromium 154.0.8037.99, native WebGL (`WebKit WebGL`), 1440 × 1000 viewport; Vite development server; React StrictMode. Production `OrbitPlanner`, `OrbitDisplay`, and `BoundingBoxEntity` are mounted in `tests/orbit-browser.html`. The offline fixture uses ellipsoid terrain and no external imagery/buildings. Inputs: Corvallis target at −123.262°, 44.564°, building height 20 m, box buffers 100 m horizontal/vertical, orbit radius 25 m, altitude 15 m AGL.

Timing starts before validation/generation and ends at the first rendered frame after replacing the path. It includes terrain lookups, camera calculations, overlay replacement, and Cesium rendering. Each count starts in a freshly loaded Cesium scene, followed by five regenerations. Counts run sequentially in one browser process; these are fresh-scene timings, not a claim that OS/GPU shader caches were cleared. Terrain/tile network loading is a prerequisite and is excluded; missing loaded terrain is rejected explicitly.

| Waypoints | First orbit in fresh scene (ms) | Five warm renders (ms)       | Warm median (ms) | Maximum observed (ms) |
| --------- | ------------------------------- | ---------------------------- | ---------------- | --------------------- |
| 8         | 77.4                            | 30.7, 31.6, 31.2, 30.9, 31.2 | 31.2             | 77.4                  |
| 25        | 39.0                            | 31.0, 31.9, 31.2, 31.2, 31.5 | 31.2             | 39.0                  |
| 50        | 40.5                            | 31.3, 30.6, 32.3, 32.0, 30.6 | 31.3             | 40.5                  |

Raw results: [orbit-browser-results.json](../evidence/orbit-browser-results.json). Screenshot of the 50-point overlay with expanded waypoint metadata:

![50 waypoint orbit in the offline Cesium fixture](../evidence/orbit-50-waypoints.png)

The globe uses point markers, with waypoint 1 in yellow, and a closed line. The ordered panel contains the full coordinates and camera angles. Avoiding per-point globe text also keeps the initial display cost low and avoids crowded labels at 50 points.

## Reproducing the checks

Run `bun run test`, `bun run check`, `bun run typecheck`, and `bun run build`. Bun was unavailable in the authoring environment, so the same `node:test` suite was executed successfully with `node --experimental-strip-types --test tests/*.test.ts` using Node 25.2.1; the other checks passed via the existing npm scripts. CI runs the suite with Bun.

For browser checks, start `bun run dev` and open `/tests/orbit-browser.html`. See the [contributing guide](../process/contributing.md). If Playwright and Chromium are already available in your tooling environment, `node tests/verify-orbit-browser.cjs` automates the fixture checks and writes JSON and a screenshot to the system temporary directory under `orbit-evidence`. Optional environment variables:

- `PLAYWRIGHT_MODULE_PATH`: path to an existing Playwright package if it is outside Node's module search path.
- `BROWSER_EXECUTABLE_PATH`: a compatible installed Chromium executable.
- `ORBIT_BASE_URL`: running dev server URL (default `http://127.0.0.1:5173`).
- `ORBIT_EVIDENCE_DIR`: destination for browser output.

Playwright is optional verification tooling, not a new application dependency. The fixture is not included in the production build entry point.

The geometry uses Cesium's [ENU transforms](https://cesium.com/learn/cesiumjs/ref-doc/Transforms.html#eastNorthUpToFixedFrame) and the UI reads [loaded terrain heights](https://cesium.com/learn/cesiumjs/ref-doc/Globe.html#getHeight).

## Remaining completion requirements

- A contributor must review and understand the generated code before merge, as required by `AGENTS.md` and the contributing guide. Automated checks do not constitute peer review.
- PR #42 remains open. The orbit branch is based on its branch; open a stacked PR against `issue-35-bounding-box` so only this issue's changes appear in the review. After the dependency merges, retarget the orbit PR to `main` and resolve any integration changes before merging. Publishing the branch was declined in the authoring session, so no orbit PR has been created.
- A smoke test using a clicked OSM building and world terrain remains to be performed with a valid Cesium ion token; none was configured in the authoring environment. The browser fixture validates the production rendering and controls, but not external tile availability or performance with those assets.
- No merge to `main` or issue closure has been performed. The issue's peer-review and merge checklist items remain pending.

Containment is a waypoint check against the operating volume, not collision avoidance or photogrammetric coverage validation. Loaded terrain is an estimate, and straight segments can have different terrain clearance between waypoints. Building footprint and missing building heights use the existing estimates. Real flight safety, neighboring obstacles, optics/overlap planning, and mission export remain outside this issue.
