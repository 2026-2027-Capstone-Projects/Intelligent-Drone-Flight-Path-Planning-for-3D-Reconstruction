# Creating GitHub Issues and Draft Items

GitHub Issues and Draft Items help the team plan, organize, assign, track, and complete project work. These guidelines apply to both.

An effective Issue answers six questions:

1. **What** needs to be accomplished?
2. **Why** is this work necessary?
3. **How** will the work be accomplished?
4. **Who** is responsible?
5. **When** should the work be completed?
6. **How will we know** that the work has been successfully completed?

The goal: any team member should be able to read an Issue and understand what needs to be done, why it matters, and how to determine whether it has been completed.

The examples on this page are illustrations based on the [requirements](../planning/requirements.md), not committed backlog items.

## 1. Title: What Needs to Be Accomplished?

Choose a short, specific, and meaningful title that communicates the expected outcome. A good title makes the purpose of the Issue clear without anyone needing to open it.

Recommended format:

```text
[ID]: [Action or Expected Outcome]
```

Examples:

- `PBI-01: Select a Target Building on the Globe`
- `PBI-02: Display Planned Waypoints on the Globe`
- `PBI-03: Generate an Orbital Flight Path`
- `SPIKE-01: Evaluate Path-Planning Algorithms`
- `BUG-01: Fix Incorrect Camera Orientation After Reload`

Use identifiers and naming conventions consistently.

Avoid vague titles such as:

- `Work on Drone`
- `Fix Problems`
- `Do Testing`
- `Implement Feature`

## 2. Description: What and Why?

The description explains what needs to be accomplished and why it matters to the project. Include:

- **Overview:** A concise description of the required functionality, improvement, or investigation.
- **Purpose:** Why this work is needed and what value it provides.
- **Expected Outcome:** What should exist or be possible when the Issue is completed.

Focus on the expected result rather than an unnecessarily detailed implementation specification.

Example for `PBI-02: Display Planned Waypoints on the Globe`:

- **Overview:** Display the generated waypoints and the path between them on the 3D globe.
- **Purpose:** Allow the user to inspect a planned flight path before using it.
- **Expected Outcome:** The application displays the waypoints and path line for a generated trajectory and replaces them when a new trajectory is generated.

## 3. Tasks: How Will the Work Be Accomplished?

Identify the main activities required to complete the Issue, using a Markdown checklist:

```markdown
- [ ] Identify how generated waypoints are represented.
- [ ] Retrieve the trajectory for the selected target.
- [ ] Display the waypoints and path line on the globe.
- [ ] Update the display when a new trajectory is generated.
- [ ] Test the display using representative trajectories.
- [ ] Document the implementation and test results.
```

Each task should be:

- **Actionable:** Clearly identifies an activity that can be performed.
- **Specific:** Avoids ambiguous descriptions.
- **Manageable:** Small enough that progress can be tracked.
- **Relevant:** Directly contributes to completing the Issue.

Tasks may be refined, added, or removed as the team learns more about the work.

For larger or independently trackable activities, consider creating separate linked Issues or sub-issues rather than an excessively long checklist.

## 4. Acceptance Criteria: How Will We Verify Success?

Acceptance Criteria (AC) define the specific, observable, and verifiable conditions that must be satisfied for the Issue to be accepted as complete. They describe what the result must accomplish, not the activities used to produce it.

Whenever applicable, specify:

- **Input or initial conditions:** Under what circumstances should the behavior occur?
- **Expected behavior:** What must the system do?
- **Observable result:** What evidence demonstrates that the requirement is satisfied?

Example for `PBI-02: Display Planned Waypoints on the Globe`:

- **AC-01:** Given a generated trajectory of 8 waypoints, the globe displays 8 waypoint markers joined by a path line.
- **AC-02:** Given a trajectory of 8 to 50 waypoints, the overlay is displayed in under 500 ms.
- **AC-03:** When trajectory data is unavailable, the application displays a status message and the Cesium viewer keeps running.

Base measurable thresholds on the project requirements. The 500 ms above comes from NFR1 in the [requirements](../planning/requirements.md). Issue-level numbers such as `AC-01` belong to that Issue and are separate from the project-level `AC1` and `AC2` in the requirements.

Avoid vague acceptance criteria such as:

- "The feature works correctly."
- "The application is user-friendly."
- "The system performs efficiently."
- "The functionality is fully implemented."

Acceptance Criteria must be testable. Another team member should be able to verify them without asking the Issue's author for clarification.

For technical investigations or spikes, Acceptance Criteria should describe the question to be answered and the evidence required, such as experimental results, comparisons, or documented conclusions.

## 5. Definition of Done: When Can the Issue Be Closed?

The Definition of Done (DoD) establishes the shared quality standards that completed work must satisfy. This project's standards are in the [Definition of Done](contributing.md#definition-of-done) section of the contributing guide.

In Scrum, the Definition of Done formally applies to the product Increment, not independently to every Issue. However, each Issue can use a completion checklist to verify that its Acceptance Criteria and the applicable Definition of Done standards have been satisfied.

Not every item requires the same evidence. For example, a spike may be completed by producing documented experimental results rather than implementing a new software feature.

An Issue should not be closed simply because someone has finished writing the code. Close it when the expected outcome has been verified and all applicable completion conditions have been satisfied.

## 6. Responsibilities, Dependencies, and Scheduling

For each Issue, use the relevant GitHub Project fields to communicate:

- **Assignee:** Who is primarily responsible for coordinating the work?
- **Status:** Is the Issue a draft, ready, in progress, blocked, or completed?
- **Priority or Order:** How important is this work relative to other items?
- **Estimate:** What is the anticipated effort or relative complexity?
- **Target Date / Sprint:** When should the work be considered or completed, if known?
- **Dependencies:** What other Issues or external conditions must be addressed first?

An Issue may involve several contributors, even when one team member is primarily responsible for it.

Identify dependencies clearly, using links to related GitHub Issues whenever possible.

Do not assign an Issue to a future Sprint merely to fill in a field. Sprint selection should reflect the team's current priorities and planning decisions.

## 7. GitHub Issue vs. Draft Item

A GitHub Project Draft Item is useful when the team has identified potential work but has not yet sufficiently defined or refined it. Use a Draft Item when:

- The scope is not yet sufficiently clear.
- Acceptance Criteria still need discussion.
- The team needs to investigate dependencies or feasibility.
- The item is a candidate for future development.

Use a GitHub Issue when the work needs to be formally tracked through the repository, with discussions, links, assignments, and development activity.

A Draft Item can be converted into an Issue when appropriate.

An Issue does not need to be fully understood before it is created. Issues can also be used to track investigations and refinement activities.

## Complete Example

**Title:** `PBI-02: Display Planned Waypoints on the Globe`

**Type:** Feature

```markdown
## Description

Display the generated waypoints and the path between them on the 3D globe.

This will allow the user to inspect a planned flight path before using it.

## Tasks

- [ ] Identify how generated waypoints are represented.
- [ ] Retrieve the trajectory for the selected target.
- [ ] Display the waypoints and path line on the globe.
- [ ] Update the display when a new trajectory is generated.
- [ ] Test the display using predefined trajectories.
- [ ] Document the test results.

## Acceptance Criteria

- AC-01: Given a generated trajectory of 8 waypoints, the globe displays 8 waypoint markers joined by a path line.
- AC-02: Given a trajectory of 8 to 50 waypoints, the overlay is displayed in under 500 ms.
- AC-03: When trajectory data is unavailable, the application displays a status message and the Cesium viewer keeps running.

## Completion Checklist

- [ ] All Acceptance Criteria have been verified.
- [ ] The implementation has been merged into the main branch.
- [ ] Relevant tests and checks have passed.
- [ ] A peer review has been completed.
- [ ] Relevant documentation and evidence have been provided.

## Additional Information

- **Assignee:** [Team Member]
- **Estimate:** [Estimate]
- **Dependencies:** [Related Issue IDs, if any]
- **Target Date / Sprint:** [If applicable]
- **Evidence:** [Links to tests, pull requests, screenshots, or demonstrations]
```

## Final Self-Check

Before starting work, ask:

1. Is the title sufficiently clear and meaningful?
2. Does the description explain what needs to be achieved and why?
3. Are the tasks specific and actionable?
4. Are the Acceptance Criteria objectively verifiable?
5. Are responsibilities and relevant dependencies identified?
6. Does everyone understand what must be demonstrated before the Issue can be closed?

Before closing an Issue, verify that its Acceptance Criteria and applicable completion conditions have been satisfied, and that the supporting evidence is accessible.

A well-structured GitHub Issue is more than a task description. It is a shared agreement about the work to be accomplished, the expected outcome, and how success will be verified.
