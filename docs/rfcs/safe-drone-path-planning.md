# RFC: Selecting 3D Reconstruction Targets and Planning Routes with Incomplete Data

**Project:** Intelligent Drone Flight-Path Planning for 3D Reconstruction

**Project ID:** CS.027

**OSU Email:** [rohwedej@oregonstate.edu](mailto:rohwedej@oregonstate.edu)

| Field         | Value                                                         |
| ------------- | ------------------------------------------------------------- |
| Author        | Johnathon Rohweder                                            |
| Date          | 2026-10-25                                                    |
| Last Revised  | 2026-11-24                                                    |
| Status        | Proposed                                                      |
| Decision Date | Pending                                                       |
| Deciders      | Our project partner, Raffaele De Amicis, and the project team |
| Superseded By | Not applicable                                                |

---

## Problem and Context

Our "Intelligent Drone Flight-Path Planning for 3D Reconstruction" project aims to let users select a building or region in a 3D interface and generate a flight path for capturing reconstruction images. Users should also be able to inspect the route. My user interaction work makes target selection and route warnings particularly relevant [1].

The application is intended for drone operators, researchers, and other users interested in creating 3D models of buildings using aerial photography. The device being planned for is a camera equipped unmanned aerial vehicle (UAV), commonly referred to as a drone. Our current focus is on pre-flight planning rather than directly controlling a physical drone.

Our map data gives us building positions and approximate heights, but not reliable information about actual building dimensions, nearby trees, power lines, or other obstacles. A path that looks clear could still collide with something missing from the map. We need to decide whether to start wider, refine after review, collect more data through a separate flight, or use additional external data.

Since my original draft, our project has implemented an operating bounding box around selected buildings. This bounding box represents a three dimensional volume within which the drone's planned flight path must remain. Users can adjust its horizontal and vertical dimensions. We are also developing functionality that allows users to define multiple flight zones and no-flight zones. This will allow users to designate areas where the drone can operate and areas it must avoid.

Our planned initial route-generation approach is an orbital flight path. This would generate waypoints around a selected building while considering altitude, distance, and camera acquisition requirements. The specific optimization algorithm has not been finalized.

This matters now because the interface and planner need to agree on what is known and unverified. Doing nothing risks making a preview appear ready, while extra requirements could delay the prototype. This choice is reversible now but harder to change once planner interfaces, validation, and flight path export formats rely on it.

---

## Options

### Option A: Generate a Fixed Offset Path

After target selection, generate a path at a set distance from the estimated building boundaries. This suits an early prototype, but a wider route could encounter unmapped obstacles, increase flight time, or reduce image detail. Distance from the building alone does not establish safety.

This option would require relatively little implementation effort because it could build on our existing bounding box and planned orbital path generator. However, it would not account for additional obstacles identified by the user.

This would be the right choice for an initial visualization prototype using simple or synthetic environments where obstacles are already known.

### Option B: Use Staged Planning with Obstacle Review

First, generate a preliminary path using estimated building dimensions. Then ask the user to review the area, adjust constraints, and mark places to avoid. The planner could refine the path using that input while still showing that it is unverified.

This gives users more control and leaves room for improved map data later. It requires more interface states and route updates, but suits a tool without automatic obstacle detection.

Our existing bounding box and planned flight and no-flight zones provide a foundation for this approach. Known obstacles could be represented as areas the planner must avoid without requiring an automated obstacle detection system.

This would be the right choice when users have additional knowledge of the environment but the project cannot guarantee complete obstacle data.

### Option C: Use a Reconnaissance Flight

A separate survey flight could collect images or measurements of obstacles missing from the map. However, that flight would also need an independent safety assessment. We do not have a confirmed obstacle detection setup or processing workflow.

This option introduces additional hardware, image processing, development time, and operational costs. However, it could provide more detailed information than existing map data alone.

### Option D: Do Nothing for Now

Keep generating routes using current map data without adding an obstacle review step. This allows basic selection and visualization work but leaves missing hazards unaddressed.

This option has the lowest immediate development cost but could create additional work later if the planner is designed without support for changing restrictions.

It only makes sense for a simulation or demonstration that clearly labels the route as unverified.

### Option E: Integrate External Obstacle and Elevation Data

Use additional geographic datasets, such as building databases, elevation models, or LiDAR point clouds, to improve the information available to the planner without requiring a separate reconnaissance flight.

One potential source is the United States Geological Survey's 3D Elevation Program (3DEP), which provides publicly available LiDAR and elevation data [4]. However, these datasets may be outdated, have limited resolution, or fail to represent smaller obstacles.

This option requires additional data processing, coordinate conversions, storage, and verification of dataset coverage. It would be appropriate if suitable datasets could be integrated within our development timeline. It could also be combined with Option B later.

---

## Analysis

Building dimensions help with clearance from the selected structure but cannot establish whether nearby space is clear. A larger offset might avoid the building while introducing new hazards and reducing camera coverage. Reconnaissance still requires a site assessment.

Our current implementation demonstrates this uncertainty. The application uses CesiumJS to display a three-dimensional globe containing terrain and buildings. When a user selects a building, the application generates an operating bounding box centered around it.

The application assumes a 30-meter square building footprint because the building metadata currently used does not provide an actual footprint. If the building height is unavailable, the application assumes a height of 10 meters. The default horizontal and vertical buffers are 20 meters and 10 meters, respectively.

These values allow the application to display an operating area but do not establish the actual boundaries of a building. Larger buildings could extend beyond the estimated footprint. This demonstrates why the application should communicate uncertainty rather than assume its geographic information is completely accurate.

The implementation also uses a maximum altitude of 120 meters above ground level (AGL), validates bounding box parameters, and can determine whether a given point is within the operating volume, including its boundaries.

We are currently extending this functionality to support multiple flight zones and no-flight zones. Under this approach, a point must be inside at least one flight zone and outside every no-flight zone to be considered within the workable area. Users will also be able to view the total workable ground area and receive warnings about invalid zones.

Option B fits this development because it builds on functionality our project already has or is actively implementing. It also separates validation against defined restrictions from verification of actual environmental conditions.

External research supports considering environmental restrictions alongside reconstruction quality. Koch, Körner, and Fraundorfer (2019) developed a UAV flight-planning approach that uses environmental information and restricted airspace when planning trajectories for 3D reconstruction [3].

Their research demonstrates the importance of considering more than distance from the target. However, their approach uses richer environmental information obtained through an initial flight. Our project does not currently have that capability. Option B applies a simpler version of this principle through user-defined restrictions rather than automatic environmental classification.

Option A is simplest to implement and maintain but cannot incorporate additional information from users. Option B adds complexity because restrictions and review status must be stored, and paths must update when inputs change. However, it keeps map information separate from what has actually been reviewed. Option C adds hardware, processing, and operational costs beyond our current scope. Option D avoids development effort but does not address missing obstacles.

Option E could improve the initial environmental model. However, acquisition dates, resolution, and coverage would need to be examined before relying on additional datasets. USGS provides spatial metadata that can assist with this evaluation [4]. External data does not eliminate the need for obstacle review.

Option B may also require more computation when routes are regenerated. Our project has established a performance requirement that standard orbital paths containing 8 to 50 waypoints should be calculated and displayed in under 500 milliseconds. We have not measured whether the proposed workflow can meet this requirement.

For the initial implementation, I propose using orbital path generation followed by validation against the operating constraints. If a candidate route violates those constraints, the planner should reject it and allow regeneration after adjustments. Finding a globally optimal path around arbitrary obstacles is outside this RFC's immediate scope.

Our application currently uses a React and TypeScript frontend, with a Python and FastAPI backend planned for trajectory calculations. Both parts should use consistent coordinate conventions, including longitude and latitude in degrees and altitude in meters above ground level. The backend should independently validate restrictions rather than relying entirely on frontend validation.

Regardless of the approach, user changes should not bypass altitude limits or geographic restrictions. Passing checks against map data should never be treated as proof of flight safety. I prefer Option B because it addresses uncertainty without attempting general autonomous obstacle avoidance, which is outside the current project scope.

---

## Recommendation and Verification Plan

I think Option B is best. Users would select a target, see its approximate boundaries, and receive a preliminary route labeled with a warning about missing obstacles. They could review the area, adjust constraints, and mark exclusion areas. The planner would update or reject the route while keeping its real-world clearance status unverified. A closer route should not automatically be considered safer.

The interface should distinguish between preliminary routes, routes that violate restrictions, outdated routes, and routes that pass geometric validation but remain unverified for actual flight.

Changing the target, altitude, flight zones, or no-flight zones must invalidate the previous route until it has been checked against the updated constraints. Invalid or outdated routes must not be available for mission export.

These are proposed acceptance criteria, not completed tests:

### AC-01: Preliminary Route Warnings

Before the integration demo, select a building with limited map data and generate a route. The interface must display a warning explaining that obstacles may be missing and that the route has not been verified for actual flight. Completing the user review must not remove this warning.

### AC-02: Flight Zone Containment

During planner integration, test synthetic flight zones with points and route segments inside, outside, and on their boundaries. Every accepted route segment must remain within the permitted operating volume and applicable altitude limits. Routes that leave and reenter the operating area between waypoints must be rejected.

### AC-03: No-Flight Zone Avoidance

Add simulated tree or power line exclusion areas. Test waypoints inside exclusion zones, segments crossing zones between waypoints, and segments touching their boundaries.

Zero accepted routes may intersect a no-flight zone. No-flight zone boundaries should be treated as excluded space. If a candidate route violates restrictions, the application must report failure rather than display it as valid.

### AC-04: Route Invalidation

Modify the target, altitude, or restrictions after generating a route. The previous route must immediately become outdated or be replaced by a newly validated route.

Outdated routes must not remain available for mission export, including when an earlier planning request finishes after the restrictions have changed.

### AC-05: Incorrect or Outdated Building Data

Test a building with a missing height, an underestimated footprint, and a simulated obstacle introduced after the original map was created.

Missing or assumed dimensions must produce an uncertainty warning. When newly supplied obstacle information conflicts with a route, that route must become invalid. Unknown collection dates must not be presented as evidence of current conditions.

The application is not expected to independently detect every missing obstacle. This test verifies that uncertainty is communicated and updated information affects validation.

### AC-06: User Understanding

Before demonstration, ask at least five test users to inspect a preliminary route and a route that passes geometric validation.

All five users should understand that neither route has been confirmed safe for actual flight and that additional site assessment is necessary. If any user misunderstands the warning, revise the wording and repeat the test.

### AC-07: Performance and Reconstruction Quality

Compare route length, estimated image coverage, and regeneration time before and after refinement using the same synthetic building and camera parameters.

Test paths containing 8, 25, and 50 waypoints. Run each case ten times and record calculation and display times. Standard orbital cases should meet the project's 500-millisecond requirement. Restrictions must not be relaxed simply to maintain reconstruction quality or performance.

### AC-08: Invalid or Unavailable Planning Inputs

Submit invalid bounding boxes, restrictions that eliminate the workable area, and unavailable map data. The application must display an appropriate status message, keep the 3D viewer running, and prevent invalid or outdated routes from being exported.

The team should document test inputs, expected outcomes, actual outcomes, and pass/fail results. Failures involving exclusion zones, invalidation, or misleading warnings must be corrected before the workflow is considered complete.

---

## Constraints

Our application is intended for pre-flight planning rather than confirming that a drone can safely operate in a particular environment. Users must still evaluate actual site conditions, applicable flight restrictions, and obstacles. The existing 120-meter altitude cap is a project constraint, not confirmation that flight is permitted at that altitude.

Our project requires core software dependencies to use permissive open-source licenses, including MIT, Apache 2.0, or BSD licenses. Option B can build on existing dependencies, while Options C and E could introduce additional software requiring licensing review.

Although our project currently has no external institutional or partner nondisclosure agreements, this does not establish unrestricted permission to publish user-provided site information or imagery.

For Option B, user-defined obstacle annotations should initially remain within the planning session unless persistent storage requirements are established. Public demonstrations and test records should use synthetic or approved locations and should not expose sensitive annotations or access credentials.

These constraints favor an approach that uses our existing tools and user-provided restrictions without introducing unnecessary external services, hardware, or data collection requirements.

---

## Delegation and Validation

AI assistance examined our existing bounding box implementation and identified relevant assumptions, altitude limits, and validation behavior. It also helped distinguish currently implemented functionality from functionality still being developed. It did not execute the application, run automated tests, or conduct physical flights.

My personal validation of the revised RFC must include the following:
- Reviewing the bounding box calculations, coordinate conventions, altitude limits, and containment behavior against our implementation.
- Reviewing the acceptance criteria to confirm that they can detect invalid routes, outdated constraints, and misleading warnings.

These checks matter because incorrect assumptions about map data or validation logic could cause the application to present an invalid route as usable. Any AI generated implementation must be reviewed and understood before being incorporated into the project.

---

## Decision

**Status: Proposed.**

I recommend Option B: generating a preliminary route followed by user review and refinement, without suggesting that the route is safe to fly.

Our existing operating bounding box and ongoing development of flight zones and no-flight zones provide a foundation for this recommendation but do not establish that the complete workflow has been implemented or formally accepted.

External obstacle datasets may be considered later as an improvement to this approach rather than a replacement for user review.

The final decision and decision date will be recorded after discussion with the project team and partner.

---

## References

[1] Oregon State University EECS Capstone. Intelligent Drone Flight-Path Planning for 3D Reconstruction.

[https://capstone.eecs.oregonstate.edu/projects/57c3b13d-dec0-4f28-8ff1-d7c455dc09c6](https://capstone.eecs.oregonstate.edu/projects/57c3b13d-dec0-4f28-8ff1-d7c455dc09c6)

[2] CS Capstone Handbook. Architecture Decision Record (ADR).

[https://capstone.alexulbrich.com/guides/adr/](https://capstone.alexulbrich.com/guides/adr/)

[3] Koch, T., Körner, M., & Fraundorfer, F. (2019). Automatic and Semantically-Aware 3D UAV Flight Planning for Image-Based 3D Reconstruction. _Remote Sensing, 11_(13), 1550.

[https://doi.org/10.3390/rs11131550](https://doi.org/10.3390/rs11131550)

[4] United States Geological Survey. 3D Elevation Program (3DEP): Products and Services, and Spatial Metadata.

[https://www.usgs.gov/3d-elevation-program/about-3dep-products-services](https://www.usgs.gov/3d-elevation-program/about-3dep-products-services)

[https://www.usgs.gov/3d-elevation-program/3dep-spatial-metadata](https://www.usgs.gov/3d-elevation-program/3dep-spatial-metadata)

[5] Cesium. Content Usage and Attribution Guide.

[https://cesium.com/learn/ion/content-usage-and-attribution-guide/](https://cesium.com/learn/ion/content-usage-and-attribution-guide/)
