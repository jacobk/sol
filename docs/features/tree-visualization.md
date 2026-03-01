# Tree Visualization

## Overview

Visualizes the conversation tree structure of a session, showing branch points, forks, and compactions. Uses a breadcrumb-style navigation approach optimized for mobile touch interaction rather than a git-graph or indented tree.

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.3:
- "As a developer, I want to visualize the conversation tree (branches, forks, compactions) so I can navigate alternate paths the agent explored."
- "As a developer, I want to tap a branch point and switch to viewing a different branch so I can compare approaches."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/server.ts` | `/api/tree/:id` endpoint |
| `public/index.html` | Branch indicators and navigation UI |

### Data Flow

{To be filled during implementation.}

### Key Functions

{To be filled during implementation.}

## Rationale

### Design Decisions

- Breadcrumb navigation over git-graph because iPhone screens are too narrow for branch lines and touch targets on graph nodes would be too small.
- Branch indicators inline in the chat view rather than a separate tree panel — keeps context visible while navigating.
- Branch switching re-renders the full chat view (stateless) rather than trying to animate transitions.

### ADR References

- [ADR 004: Tree Visualization Approach](../ADR/004-tree-visualization-approach.md) - Full rationale for breadcrumb approach

## Current Limitations

1. Can only view one branch at a time — no side-by-side comparison.
2. Deep trees with many branches may require many taps to explore.
