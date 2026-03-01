# Model Switching

## Overview

Allows the user to view available AI models and switch the active model mid-session from the Sol mobile interface. Uses pi's RPC protocol to query available models and change the active model without restarting the session.

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.5:
- "As a developer, I want to switch the active model mid-session so I can adjust cost/capability tradeoffs from my phone."

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/app.ts` | `GET /api/session/:id/models` and `PUT /api/session/:id/model` endpoints |
| `frontend/src/components/ModelSwitcher.tsx` | Model selection UI (badge trigger + bottom sheet) |
| `frontend/src/components/SessionDetail.tsx` | Integrates ModelSwitcher into the session header |

### Data Flow

1. **List models:** Frontend calls `GET /api/session/:id/models` → Express sends `{ type: "get_available_models" }` to pi RPC stdin → pi responds with `available_models` event on stdout → Express returns JSON to frontend.
2. **Switch model:** Frontend calls `PUT /api/session/:id/model` with `{ model: "<name>" }` → Express sends `{ type: "set_model", model: "<name>" }` to pi RPC stdin → pi responds with `model_set` event on stdout → Express returns JSON to frontend → `ModelSwitcher` calls `onModelChange` to update the displayed model.

### Key Functions

- **`GET /api/session/:id/models`** (app.ts) — One-time listener pattern with 10s timeout. Sends `get_available_models` RPC command, waits for `available_models` or `get_available_models_response` event.
- **`PUT /api/session/:id/model`** (app.ts) — Validates `model` field, sends `set_model` RPC command, waits for `model_set` or `set_model_response` event.
- **`ModelSwitcher`** (ModelSwitcher.tsx) — Standalone Preact component. Props: `sessionId`, `isRpcConnected`, `currentModel`, `onModelChange`. Renders a tappable Badge (interactive when RPC connected, read-only otherwise) that opens a BottomSheet with the model list.

## Rationale

### Design Decisions

- **Bottom sheet UI pattern:** Model selection is presented as a bottom sheet (slide-up menu) rather than a dropdown, following the mobile-native ergonomics principle from the design system. This keeps the interaction in the thumb zone.
- **Requires active RPC session:** Model switching only works for sessions with an active `pi --mode rpc` subprocess. For historical (read-only) sessions, the model info is display-only.
- **Show current model prominently:** The active model name is displayed in the session header as a tappable badge, making it both visible and actionable.

### ADR References

- [ADR 005: Pi RPC Integration](../ADR/005-pi-rpc-integration.md) - `get_available_models` and `set_model` RPC commands

## Current Limitations

1. Only works for active (RPC-connected) sessions — cannot pre-select a model for a session before connecting.
2. No model capability or pricing information displayed — just model names.
3. No per-model token limit warnings.
