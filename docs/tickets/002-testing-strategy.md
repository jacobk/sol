# TICKET-002: Testing Strategy Setup

**Related:** ADR 007, PRD Section 2.7, PRD Section 3.9
**Feature:** Testing Strategy from docs/features/testing-strategy.md
**Status:** In Review
**Created:** 2026-03-01

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/007-testing-strategy.md` - Testing architecture decision (runner, levels, conventions)
2. `docs/PRD/001-sol.md` Section 2.7, 3.9 - User stories and functional requirements for testing
3. `docs/features/testing-strategy.md` - Feature overview and rationale
4. `src/server.ts` - Main server file that needs app/server separation
5. `AGENTS.md` - Project conventions (ESM, strict TS, imports with .js extension)

## Implementation Checklist

### 1. Install Dependencies

Add `vitest` and `supertest` (+ `@types/supertest`) as dev dependencies.

### 2. Create Vitest Configuration

Create `vitest.config.ts` at project root. Configure for:
- ESM mode
- TypeScript strict
- Include pattern: `src/**/*.test.ts`
- Exclude: `node_modules`, `dist`
- Environment: `node` (for backend tests)

### 3. Add NPM Scripts

Add to `package.json`:
- `"test": "vitest run"`
- `"test:watch": "vitest"`
- `"test:coverage": "vitest run --coverage"`

### 4. Refactor App/Server Separation

Split `src/server.ts` into:
- `src/app.ts` — Exports the Express `app` instance (route registration, middleware)
- `src/server.ts` — Imports `app` from `./app.js` and calls `app.listen()`

This enables `supertest` to test routes without binding to a port.

### 5. Create Shared Test Utilities

Create `src/__test__/` directory with:
- `src/__test__/setup.ts` — Global test setup (if needed)
- `src/__test__/mocks.ts` — Mock factories for SDK (`SessionManager`), RPC subprocess, and Express request/response objects

### 6. Write Initial Unit Tests

Create `src/app.test.ts` with integration tests for existing API endpoints:
- `GET /api/sessions` — Returns sessions grouped by project (mock SDK)
- `GET /api/session/:id` — Returns session entries (mock SDK)
- Error cases: 404 for missing session, 500 for SDK errors

These serve as the baseline regression suite and as a template for future endpoint tests.

### 7. Update AGENTS.md

Update the "Build / Lint / Test Commands" section to include:
```bash
npm test           # Run all tests (vitest)
npm run test:watch # Watch mode for development
```

Remove the note "No test framework is configured."

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** App/server separation is a necessary refactor (Step 4)
- [x] **DRY check** - Mock factories in `src/__test__/mocks.ts` prevent duplication across test files
- [x] **Modularity** - Extracting `app.ts` from `server.ts` improves testability and reusability
- [x] **Debt impact** - This ticket directly reduces technical debt by introducing automated verification

**Specific refactoring tasks:**
- Extract Express app creation and route registration from `server.ts` into `app.ts`
- Ensure all route handlers are importable/testable in isolation

## Testing Requirements

### Verification Checklist

Implementation agent MUST run before marking complete:
```bash
npm run build  # Must pass
npm test       # Must pass — including the new tests written in this ticket
```

## Acceptance Criteria

- [ ] `vitest` and `supertest` are installed as dev dependencies
- [ ] `vitest.config.ts` exists and is correctly configured for ESM + TypeScript
- [ ] `npm test` runs successfully and executes at least one test
- [ ] `npm run test:watch` starts Vitest in watch mode
- [ ] Express app is exported from `src/app.ts` separately from `src/server.ts`
- [ ] `src/server.ts` imports from `src/app.ts` and only calls `listen()`
- [ ] At least one API integration test exists using `supertest`
- [ ] `src/__test__/mocks.ts` contains reusable mock factories
- [ ] `npm run build` still passes after all changes
- [ ] AGENTS.md is updated to reflect the new test commands

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add vitest, supertest deps; add test scripts |
| NEW: `vitest.config.ts` | Vitest configuration |
| `src/server.ts` | Extract app creation to app.ts, keep only listen() |
| NEW: `src/app.ts` | Express app creation, route registration, middleware |
| NEW: `src/__test__/mocks.ts` | Shared mock factories for SDK and RPC |
| NEW: `src/app.test.ts` | API integration tests for existing endpoints |
| `AGENTS.md` | Update build/test commands section |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- The app/server split is the minimal refactor needed — do not reorganize routes or middleware beyond what's required
- Initial tests should cover existing endpoints only — new feature tests come with their respective tickets
- All future tickets should include a testing requirement that references this testing infrastructure
