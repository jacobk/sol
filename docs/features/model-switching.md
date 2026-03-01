# Model Switching

## Overview

Allows the user to view available AI models and switch the active model mid-session from the Sol mobile interface. Uses pi's RPC protocol to query available models and change the active model without restarting the session.

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.5:
- "As a developer, I want to switch the active model mid-session so I can adjust cost/capability tradeoffs from my phone."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/server.ts` | `/api/session/:id/models` (GET) and `/api/session/:id/model` (PUT) endpoints |
| `frontend/src/components/ModelSwitcher.tsx` | Model selection UI (bottom sheet) |

### Data Flow

{To be filled during implementation.}

### Key Functions

{To be filled during implementation.}

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
