# Tree Visualization

## Overview

Visualizes the conversation tree structure of a session, showing branch points, forks, and compactions. Uses a breadcrumb-style navigation approach optimized for mobile touch interaction rather than a git-graph or indented tree.

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.3:
- "As a developer, I want to visualize the conversation tree (branches, forks, compactions) so I can navigate alternate paths the agent explored."
- "As a developer, I want to tap a branch point and switch to viewing a different branch so I can compare approaches."

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/sessions.ts` | Tree serialization (`getSessionTree`, `getSessionBranch`) and preview extraction |
| `src/app.ts` | `/api/tree/:id` route, updated `/api/session/:id` with `?leafId=` query param |
| `frontend/src/components/SessionDetail.tsx` | Branch indicators at branch points, tree overview toggle in header |
| `frontend/src/components/BranchSelector.tsx` | `BranchSelector` and `TreeOverview` BottomSheet components |

### Data Flow

1. `SessionDetail` fetches both `/api/session/:id` (for entries) and `/api/tree/:id` (for tree structure) on mount.
2. Tree data is used to build a `childCountMap` — entries with >1 child show a "⑂ N branches" Badge indicator.
3. Tapping a branch indicator opens `BranchSelector` BottomSheet with sibling branch previews (first message, depth, leaf preview).
4. Selecting a branch finds the leaf of that subtree and re-fetches `/api/session/:id?leafId=<leafId>` to get the new branch path.
5. The tree overview button (⑂ in header) opens `TreeOverview` BottomSheet listing all leaf-to-root branches with descriptions.

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `getSessionTree()` | `src/sessions.ts` | Opens session via SDK, calls `sm.getTree()`, serializes to `TreeNodeResponse[]` |
| `getSessionBranch()` | `src/sessions.ts` | Calls `sm.getBranch(leafId)` for branch-specific entry retrieval |
| `extractEntryPreview()` | `src/sessions.ts` | Extracts short preview text from any entry type for tree node summaries |
| `serializeTreeNode()` | `src/sessions.ts` | Recursively converts `SessionTreeNode` to API response format |
| `buildChildCountMap()` | `SessionDetail.tsx` | Builds entry ID → child count map for branch point detection |
| `collectAllBranches()` | `SessionDetail.tsx` | Walks tree to collect all leaf paths for tree overview |

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

## Related Features

- [Session Management](session-management.md) - Extends tree access to all sessions and adds fork-from-message capability
