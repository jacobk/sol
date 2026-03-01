# ADR 002: Session Discovery via SDK

**Date:** 2026-02-28
**Status:** Accepted
**Supersedes:** N/A

## Context

Sol needs to discover and list all pi sessions on the machine for its session list view. Two approaches were considered:

**Approach A (SDK):** Use `SessionManager.listAll()` and `SessionManager.open()` from `@mariozechner/pi-coding-agent`.

**Approach B (Direct parsing):** Read JSONL files directly with `fs`, parse JSON line-by-line.

The session format has evolved through 3 versions (v1 linear → v2 tree → v3 renamed roles). Sessions use tree-structured entries with `id`/`parentId` linking for in-place branching.

**Scope:** This ADR covers **session discovery and historical reading only** — listing sessions, reading past conversation entries, and navigating tree structures. Active session interaction (prompts, streaming, model switching) is handled via pi's RPC mode (see [ADR 005](005-pi-rpc-integration.md)).

## Decision

We will use Approach A — the `SessionManager` SDK for session discovery and historical reading.

### API Surface Used

```typescript
// List all sessions across all projects
SessionManager.listAll(onProgress?) → SessionInfo[]

// Open a specific session for historical reading
SessionManager.open(path) → SessionManager

// Read session data
sm.getEntries()    // all entries
sm.getTree()       // tree with children
sm.getBranch()     // current branch (root→leaf)
sm.getHeader()     // session metadata
sm.getLeafId()     // current position
sm.getChildren(id) // children of an entry
```

### What This Does NOT Cover

- Sending prompts or receiving streaming output → [ADR 005: Pi RPC Integration](005-pi-rpc-integration.md)
- Writing to session files → pi owns session persistence via RPC
- File browsing / git operations → direct `child_process` and `fs` calls

### Alternatives Rejected

Direct JSONL parsing would avoid the dependency but requires:
- Reimplementing v1→v3 migration
- Reimplementing tree traversal (branch walking, child lookup)
- Handling partial writes (trailing incomplete lines)
- Tracking all entry types and their shapes

All of this is already implemented and tested in `SessionManager`.

## Consequences

### Positive

- Handles version migration automatically
- Tree traversal is built in and tested
- Future session format changes are handled by upgrading the dependency
- Type-safe access to all entry types

### Negative

- `@mariozechner/pi-coding-agent` is a large dependency (pulls in AI providers, tool definitions, etc.)
- Tied to pi's release cycle for session format changes

### Technical

- Import only `SessionManager` — tree-shake is not critical since this is a server, not a browser bundle
- Session files are read-only from Sol's perspective — all writes go through pi RPC

### Maintainability

- Single source of truth for session parsing logic (the SDK)
- No duplicated parsing code to maintain
- Upgrading the pi dependency automatically picks up format changes
- Clear boundary: SDK for reading, RPC for writing
