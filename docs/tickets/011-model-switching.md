# TICKET-011: Model Switching

**Related:** ADR 005, PRD 001 Section 3.6
**Feature:** [Model Switching](../features/model-switching.md)
**Status:** Ready for Implementation (depends on TICKET-003, TICKET-008, TICKET-009)
**Created:** 2026-03-01

## Context to Load

1. `docs/ADR/005-pi-rpc-integration.md` - `get_available_models` and `set_model` RPC commands
2. `docs/PRD/001-sol.md` Section 3.6 - Model switching requirements
3. `docs/features/model-switching.md` - Feature overview
4. `src/rpc.ts` - RPC subprocess manager (from TICKET-008)

## Implementation Checklist

### 1. Add model API endpoints

Add to `src/server.ts`:
- `GET /api/session/:id/models` — sends `get_available_models` RPC command, returns model list
- `PUT /api/session/:id/model` — sends `set_model` RPC command with selected model name

Both are thin wrappers around `sendCommand()` from `src/rpc.ts`.

### 2. Build model switcher component

Create `frontend/src/components/ModelSwitcher.tsx`:
- Current model displayed as a tappable Badge in the session detail header
- Tapping opens a BottomSheet (from TICKET-003) listing available models
- Active model is visually indicated (checkmark or highlight)
- Selecting a model sends the `set_model` command and updates the display

### 3. Integrate with session detail

Add the model Badge to SessionDetail header. Only show as interactive (tappable) when the session has an active RPC connection. For historical sessions, show model as read-only metadata.

## Maintainability

- [ ] **Modularity** — ModelSwitcher is a standalone component, receives session ID and RPC status as props
- [ ] **DRY check** — Reuses BottomSheet and Badge primitives from TICKET-003

**Specific refactoring tasks:** None — straightforward feature using existing primitives and RPC infrastructure.

## Testing Requirements

### Verification Checklist

```bash
npm run build  # Must pass
# With an active session connected:
curl http://localhost:8081/api/session/<id>/models | jq .
```

## Acceptance Criteria

- [ ] `GET /api/session/:id/models` returns available models for the active session
- [ ] `PUT /api/session/:id/model` switches the active model
- [ ] Current model displayed as a Badge in the session header
- [ ] Tapping model Badge opens BottomSheet with model list
- [ ] Active model visually indicated in the list
- [ ] Model switching only available for RPC-connected sessions
- [ ] Historical sessions show model as read-only metadata

## Files to Modify

| File | Change |
|------|--------|
| MODIFY: `src/server.ts` | Add `/api/session/:id/models` and `/api/session/:id/model` routes |
| NEW: `frontend/src/components/ModelSwitcher.tsx` | Model selection BottomSheet |
| MODIFY: `frontend/src/components/SessionDetail.tsx` | Add model Badge to header |
