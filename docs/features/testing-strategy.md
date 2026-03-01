# Testing Strategy

## Overview

Sol needs a comprehensive testing strategy that enables AI coding agents to implement tickets autonomously without requiring human verification of output. Currently, the only verification is `npm run build` (type-check), which catches type errors but not logic errors, broken API contracts, or regressions.

This feature introduces Vitest as the test runner with a layered approach: unit tests for pure logic, API integration tests for Express endpoints, and (future) frontend component tests. The goal is that every ticket's acceptance criteria can be verified by running `npm test`.

## User Stories

From [PRD 001](../PRD/001-sol.md):
- "As a developer, I want agents to verify their own implementations so that ticket completion doesn't require manual human testing."
- "As a developer, I want automated regression detection so that new features don't silently break existing ones."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest configuration (ESM, TypeScript, path aliases) |
| `src/server.ts` | Refactored to export app separately from listen() |
| `src/__test__/` | Shared test utilities, mock factories, fixtures |
| `src/**/*.test.ts` | Co-located unit and integration tests |
| `package.json` | New scripts: test, test:watch, test:coverage |

### Data Flow

{To be completed by implementation agent.}

### Key Functions

{To be completed by implementation agent.}

## Rationale

### Design Decisions

1. **Vitest over Jest/Mocha/tap:** Vitest has native ESM and TypeScript support without additional transpilation config. It aligns with the existing Vite frontend toolchain and `moduleResolution: bundler` setting. Jest requires complex ESM configuration; Mocha needs separate assertion libraries.

2. **Co-located test files over `__tests__` directories:** Placing `foo.test.ts` next to `foo.ts` makes tests discoverable and keeps related code together. This is the Vitest default and matches the project's flat source structure.

3. **supertest for API integration tests:** `supertest` allows testing Express routes without starting a real HTTP server, keeping tests fast and deterministic. It's the de facto standard for Express testing.

4. **App/server separation:** Extracting the Express `app` from the `listen()` call is required for `supertest` and is itself a modularity improvement that enables reuse in other contexts.

5. **Mock at module boundaries, not deep internals:** SDK and RPC dependencies are mocked at the import level, not by patching internals. This keeps tests resilient to refactoring within modules while still testing the integration surface.

### ADR References

- [ADR 007: Testing Strategy](../ADR/007-testing-strategy.md) - Core technical decision for test runner, levels, and conventions
- [ADR 001: Tech Stack](../ADR/001-tech-stack.md) - Constraints on framework choices (ESM, TypeScript strict, tsx)
- [ADR 003: Standalone Server Architecture](../ADR/003-standalone-server-architecture.md) - Express app structure that tests must work with

## Current Limitations

1. Frontend component tests are deferred until frontend components exist (Level 3 in ADR 007).
2. No end-to-end browser tests — the mobile-first nature makes E2E complex and is out of scope.
3. RPC subprocess tests use mocked stdin/stdout, not real `pi` processes — contract drift is possible if pi's RPC protocol changes.
4. No CI pipeline — tests run locally by agents and developers. CI integration is a future consideration.
