# RFC: Selecting 3D Reconstruction Targets and Planning Routes with Incomplete Data

Project: Intelligent Drone Flight-Path Planning for 3D Reconstruction

Project ID: CS.027

OSU Email: rohwedej@oregonstate.edu

|Field|Value|
|---|---|
|Author|Johnathon Rohweder|
|Date|2026-10-25|
|Status|Proposed|
|Decision Date|Pending|
|Deciders|Our project partner, Raffaele De Amicis|
|Superseded By|Not applicable|

---
## Problem and Context

Our "Intelligent Drone Flight-Path Planning for 3D Reconstruction" project aims to let users select a building or region in a 3D interface and generate a flight path for capturing reconstruction images. Users should also be able to inspect the route. My user interaction work makes target selection and route warnings particularly relevant [1].

Our map data gives us building position, approximate height, and dimensions, but not reliable information about nearby trees, power lines, or other obstacles. A path that looks clear could still collide with something missing from the map. We need to decide whether to start wider, refine after review, or collect more data through a separate flight.

This matters now because the interface and planner need to agree on what is known and unverified. Doing nothing risks making a preview appear ready, while extra requirements could delay the prototype. This choice is reversible now but harder to change once planner interfaces and export formats rely on it.

---
## Options

### Option A: Generate a Fixed Offset Path

After target selection, generate a path at a set distance from the estimated building boundaries. This suits an early prototype, but a wider route could encounter unmapped obstacles, increase flight time, or reduce image detail. Distance from the building alone does not establish safety.

### Option B: Use Staged Planning with Obstacle Review

First, generate a preliminary path using known building dimensions. Then ask the user to review the area, adjust constraints, and, if supported, mark places to avoid. The planner could refine the path using that input while still showing that it is unverified.

This gives users more control and leaves room for improved map data later. It requires more interface states and route updates, but suits a tool without automatic obstacle detection.

### Option C: Use a Reconnaissance Flight

A separate survey flight could collect images or measurements of obstacles missing from the map. However, that flight would also need an independent safety assessment. We do not have a confirmed obstacle detection setup or processing workflow. This option is more suitable for future work with appropriate equipment, testing, and operators.

### Option D: Do Nothing for Now

Keep generating routes using current map data without adding an obstacle review step. This allows basic selection and visualization work, but leaves missing hazards unaddressed. It only makes sense for a simulation or demonstration that clearly labels the route as unverified.

---
## Analysis

Building dimensions help with clearance from the selected structure, but cannot establish whether nearby space is clear. A larger offset might avoid the building while introducing new hazards and reducing camera coverage. Reconnaissance still requires a site assessment.

Option A is simplest to implement and maintain but cannot incorporate additional information from users. Option B adds complexity because restrictions and review status must be stored, and paths must update when inputs change. However, it keeps map information separate from what has actually been reviewed. Option C adds hardware, processing, and operational costs beyond our current interface work. Option D avoids development effort but does not address missing obstacles.

Option B may also require more computation when routes are regenerated. We have not measured that yet. Regardless of the approach, user changes should not bypass altitude limits or geofences, and passing checks against map data should never be treated as proof of flight safety. I like Option B because it addresses the uncertainty without attempting general autonomous obstacle avoidance, which is outside the current project scope [1].

Thus far, users can select and highlight a specific building but nothing has yet to be created that resembles a bounding box that allows users to create or edit a path or an area a path could be created. 

---
## Recommendation and Verification Plan

I think Option B is best. Users would select a target, see its approximate boundaries, and receive a preliminary route labeled with a warning about missing obstacles. They could review the area, adjust constraints, and, if implemented, mark exclusion areas. The planner would update the route while keeping its clearance status unverified. A closer route should not automatically be considered safer.

These are proposed checks, not completed tests:

1. Before the integration demo, select a building with limited map data and confirm the route is marked preliminary with unknown obstacles noted.
2. During planner integration, check synthetic buildings to confirm route segments meet the team's chosen distance rules or report violations.
3. Add simulated tree or cable exclusion areas and confirm the planner avoids them or reports that no valid route exists.
4. Before merging UI changes, change the target or restrictions and confirm an old route updates or becomes invalid.
5. Before demonstration, ask users whether they understand that map-based clearance is not site verification. Record confusion and revise the wording.
6. When the planner is ready, compare route length, estimated image coverage, and regeneration time before and after refinement.

---
## Constraints

Real flights require assessment of site conditions, airspace restrictions, and qualified operation. We need to confirm whether user annotations can be stored or shared, and any partner confidentiality or IP restrictions. We also need to confirm the licensing terms of our map data, including whether the geographic information can be stored, modified, or redistributed. These details are still unknown, so sensitive site information should not appear in public reviews. The project does not require autonomous obstacle avoidance [1].


---
## Delegation and Validation

I used AI to organize and shorten the RFC and compare options. It did not inspect code or run tests or flights. I checked the project description for scope [1] and the ADR guide for the format [2].

Before a decision, I need to review our actual UI and planner connection, confirm map data limitations with teammates, and test a simulated route intersecting an unmapped obstacle. I also need to check whether the warning and review workflow fits our project timeline. These checks matter because an incorrect assumption about the map data could make a generated route appear safer than it actually is.

---
## Decision

Status: Proposed. I recommend we generate a preliminary route followed by user review and optional refinement, without suggesting it is safe to fly. The team will record the outcome, decision date, decision chair, and deciders after discussion.

---
## References

[1] Oregon State University EECS Capstone, Intelligent Drone Flight-Path Planning for 3D Reconstruction: [https://capstone.eecs.oregonstate.edu/projects/57c3b13d-dec0-4f28-8ff1-d7c455dc09c6](https://capstone.eecs.oregonstate.edu/projects/57c3b13d-dec0-4f28-8ff1-d7c455dc09c6)

[2] CS Capstone Handbook, Architecture Decision Record (ADR): [https://capstone.alexulbrich.com/guides/adr/](https://capstone.alexulbrich.com/guides/adr/)