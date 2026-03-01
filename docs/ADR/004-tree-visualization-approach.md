# ADR 004: Tree Visualization Approach

**Date:** 2026-02-28
**Status:** Accepted
**Supersedes:** N/A

## Context

Pi sessions use a tree structure where entries have `id`/`parentId` links. Branches occur when the user forks a conversation or navigates to an earlier point. We need to visualize this tree on mobile (iPhone Safari).

Options considered:

1. **Git-log graph** — vertical lines with branch/merge visualization, like `git log --graph`.
2. **Indented tree list** — expandable/collapsible nested list, like a file explorer.
3. **Breadcrumb navigation** — show the current branch as a linear chat view, with indicators at branch points and a way to switch branches.

## Decision

We will use Option 3 — breadcrumb-style navigation with branch indicators.

### How It Works

- The session detail view shows the current branch as a linear chat (root → leaf).
- At branch points (entries with multiple children), a visual indicator shows the number of branches.
- Tapping a branch indicator opens a selector showing sibling branches with preview text.
- Selecting a different branch re-renders the chat view for that path.
- A "tree overview" toggle shows a compact summary of all branches with their depths and leaf previews.

### Why Not Git-Graph

A git-graph visualization requires horizontal space for branch lines and is difficult to render well on a 390px-wide iPhone screen. Touch targets for selecting individual nodes on graph lines would be too small. It also requires a canvas or SVG rendering layer, adding complexity.

### Why Not Indented List

An indented list works for shallow trees but becomes hard to navigate when branches are deep (10+ levels). It also doesn't show message content inline, requiring a separate detail pane.

## Consequences

### Positive

- Linear chat view is the natural reading format — matches how conversations flow
- Works well on narrow mobile screens
- Branch switching is explicit and deliberate (tap indicator → pick branch)
- No special rendering library needed (plain HTML/CSS)

### Negative

- Can only view one branch at a time (no side-by-side comparison)
- Deep branch hierarchies may require many taps to explore fully

### Technical

- Backend provides `getTree()` for the full structure and `getBranch(leafId)` for a specific path
- Frontend maintains state: which leaf is currently displayed
- Branch indicators computed by checking `getChildren(entryId).length > 1`

### Maintainability

- Simple DOM manipulation — no canvas, SVG, or visualization library
- Branch switching is a full re-render of the chat view (stateless, easy to reason about)
- Could be upgraded to a richer visualization later without changing the API
