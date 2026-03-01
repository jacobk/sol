# ADR 007: Testing Strategy

**Date:** 2026-03-01
**Status:** Proposed
**Supersedes:** N/A

## Context

Sol currently has no testing infrastructure — no test framework, no test files, no test scripts. The only verification is manual: `npm run build` (type-check) plus manual curl/browser testing. This is explicitly noted in AGENTS.md: "No test framework is configured."

This creates a critical bottleneck: AI coding agents implementing tickets cannot verify their own work beyond type-checking. Human developers must manually verify every change, defeating the purpose of autonomous agent workflows. As the codebase grows (backend API routes, RPC process management, SSE streaming, frontend components), the risk of regressions increases and the cost of manual verification compounds.

The project needs a testing strategy that:

1. Enables agents to verify ticket acceptance criteria autonomously.
2. Catches regressions in existing features when new features are added.
3. Fits the existing tech stack (TypeScript, ESM, tsx, Express v4, Preact).
4. Keeps the dependency footprint minimal and the feedback loop fast.

## Decision

We will adopt a layered testing strategy with **Vitest** as the sole test runner, covering three levels: unit tests, API integration tests, and (optionally) frontend component tests.

### Test Runner: Vitest

Vitest is chosen because:

- Native ESM and TypeScript support — no additional transpilation config needed.
- Compatible with the existing `tsx`/esbuild pipeline and `moduleResolution: bundler`.
- Fast watch mode for local development.
- Built-in coverage reporting.
- Preact/JSX support via configuration (for future frontend component tests).
- Single dependency replaces the need for separate test runner, assertion library, and mock utilities.

### Test Levels

#### Level 1: Unit Tests

- Pure functions, data transformations, utility modules.
- No I/O, no network, no subprocess dependencies.
- Mock external dependencies (SDK, filesystem, child_process) using Vitest's built-in mocking.
- Target: all backend modules that contain extractable logic.

#### Level 2: API Integration Tests

- Use `supertest` to test Express route handlers against a running app instance.
- Mock the pi SDK (`SessionManager`) and RPC subprocess layer at the module boundary.
- Verify HTTP status codes, response shapes, SSE event streams, and error handling.
- Target: every endpoint in the API table from PRD Section 3.9.

#### Level 3: Frontend Component Tests (Future)

- Use Vitest with `@testing-library/preact` for component-level tests.
- Not in initial scope — deferred until frontend components exist.
- Documented here to establish the pattern early.

### Test File Conventions

- Test files live adjacent to source files: `src/foo.test.ts` alongside `src/foo.ts`.
- Frontend component tests: `src/components/Foo.test.tsx` alongside `src/components/Foo.tsx`.
- Shared test utilities and fixtures go in `src/__test__/` directory.
- File naming: `{module-name}.test.ts` or `{ComponentName}.test.tsx`.

### NPM Scripts

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

### Agent Verification Workflow

Every implementation ticket's "Testing Requirements" section will include:

```bash
npm run build   # Type-check must pass
npm test        # All tests must pass
```

Agents implementing tickets MUST:
1. Write tests for new functionality as part of the implementation.
2. Run the full test suite before marking a ticket complete.
3. Ensure no existing tests are broken by their changes.

### Test Writing Guidelines for Agents

- Every new backend module must have a corresponding `.test.ts` file.
- Every new API endpoint must have integration test coverage.
- Tests must verify the acceptance criteria from the ticket.
- Tests must be deterministic — no timing-dependent assertions, no real network calls.
- Use Vitest's `vi.mock()` for module-level mocking, `vi.fn()` for function spies.

## Consequences

### Positive

- Agents can autonomously verify their implementations against acceptance criteria.
- Regressions are caught automatically when new features are added.
- Type-checking + tests provide a strong confidence signal without human intervention.
- Vitest's speed keeps the feedback loop tight (<5s for unit tests).
- Single test framework reduces cognitive overhead and dependency sprawl.

### Negative

- Adding `vitest` and `supertest` increases dev dependencies.
- Writing tests adds implementation time to each ticket (estimated 20-30% overhead).
- Mock-heavy integration tests can drift from real behavior if SDK/RPC contracts change.

### Technical

- `vitest` requires a `vitest.config.ts` or config in `vite.config.ts` for path resolution.
- ESM mocking in Vitest requires careful use of `vi.mock()` with factory functions.
- `supertest` needs the Express app exported separately from the `listen()` call (app vs server separation).
- Frontend tests will require additional config for JSX transform when added later.

### Maintainability

- Co-located test files make it easy to find and update tests when modifying modules.
- Shared test utilities in `src/__test__/` prevent fixture duplication across tests.
- The app/server separation required for `supertest` is itself a modularity improvement.
- Every new module automatically gets a testing surface, preventing untested code from accumulating.
