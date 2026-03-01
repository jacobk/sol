# Plan: TICKET-011 — Model Switching

## Objective

Add model listing and switching capabilities to Sol, both as backend API endpoints (proxying to pi RPC) and as a frontend ModelSwitcher component integrated into the session detail view.

## Analysis

### What Exists

- **`src/rpc.ts`** — Full RPC subprocess management with `sendCommand()`, `onEvent()`/`offEvent()` listener pattern, idle timeout. Ready to use.
- **`src/app.ts`** — Already has a request-response RPC pattern in `GET /api/session/:id/state` that sends a command, sets up a one-time listener with timeout, and returns the response. The model endpoints will follow the same pattern exactly.
- **`frontend/src/components/ui/BottomSheet.tsx`** — Headless UI-based bottom sheet, ready to use.
- **`frontend/src/components/ui/Badge.tsx`** — Badge component with variants, already used in SessionDetail for "Live" indicator and assistant model display.
- **`frontend/src/components/SessionDetail.tsx`** — Large component (~700 lines) with header area containing Back button, title, Connect/Live button, Files button, tree overview, and collapse toggle. Model badge needs to be inserted here.
- **`src/app.test.ts`** — Has tests for the `/state` endpoint using the same one-time listener pattern; model endpoint tests will follow suit.

### RPC Commands (from ADR 005)

- `get_available_models` → Sol sends `{ type: "get_available_models" }`, pi responds with event containing model list
- `set_model` → Sol sends `{ type: "set_model", model: "<name>" }`, pi responds with confirmation event

### Risks / Edge Cases

1. **RPC response event types** — We need to know the exact event types pi sends back for `get_available_models` and `set_model`. Based on the `get_state` pattern (which checks for `"state"` or `"get_state_response"`), we should check for `"available_models"` / `"get_available_models_response"` and `"model_set"` / `"set_model_response"`. May need to verify against actual pi RPC behavior.
2. **Race conditions** — Multiple in-flight model requests could confuse one-time listeners. The existing `get_state` pattern has this same limitation; acceptable for MVP.
3. **Historical sessions** — The `AssistantMeta` component already shows model as a Badge per message. The new feature adds a header-level badge for the *active* model. For historical sessions, this should either be hidden or show the last-used model as read-only.
4. **Model list caching** — The available models list is unlikely to change mid-session. Could cache on frontend after first fetch, but for MVP, fetch each time the bottom sheet opens (keeps it simple).

### Constitution Compliance

- ✅ No direct session file writes — uses RPC
- ✅ No auth — network-level via Tailscale
- ✅ No orphaned processes — existing RPC lifecycle handles this
- ✅ Mobile-first — BottomSheet in thumb zone, 44x44pt touch targets
- ✅ Dark theme with semantic tokens — uses existing Badge/BottomSheet primitives
- ✅ Strict typing, ESM, `.js` extensions

## Step-by-Step Tasks

### Task 1: Add `GET /api/session/:id/models` endpoint

**File:** `src/app.ts`

Add a new route following the exact pattern of `GET /api/session/:id/state`:
- Check `isConnected(sessionId)`, return 404 if not
- Set up a one-time listener with 10s timeout
- Send `{ type: "get_available_models" }` via `sendCommand()`
- Listen for response event (type `"available_models"` or `"get_available_models_response"`)
- Handle `rpc_exit`/`rpc_error` while waiting
- Return the event as JSON

Place the route near the existing `/state` endpoint (after line ~305 in app.ts).

### Task 2: Add `PUT /api/session/:id/model` endpoint

**File:** `src/app.ts`

Add a new route:
- Check `isConnected(sessionId)`, return 404 if not
- Validate `req.body.model` is a non-empty string, return 400 if missing
- Set up a one-time listener with 10s timeout
- Send `{ type: "set_model", model: req.body.model }` via `sendCommand()`
- Listen for response event (type `"model_set"` or `"set_model_response"`)
- Handle `rpc_exit`/`rpc_error` while waiting
- Return the event as JSON

Place immediately after the models GET endpoint.

### Task 3: Add backend tests for model endpoints

**File:** `src/app.test.ts`

Add tests following the existing `get_state` test pattern:
- `GET /api/session/:id/models` — returns model list when connected
- `GET /api/session/:id/models` — returns 404 when not connected
- `PUT /api/session/:id/model` — switches model successfully
- `PUT /api/session/:id/model` — returns 400 when model field missing
- `PUT /api/session/:id/model` — returns 404 when not connected

### Task 4: Create `ModelSwitcher.tsx` component

**File:** `frontend/src/components/ModelSwitcher.tsx` (NEW)

Props:
```typescript
interface ModelSwitcherProps {
  sessionId: string;
  isRpcConnected: boolean;
  currentModel?: string;  // from session state or last assistant message
}
```

Component behavior:
- Renders a tappable Badge showing the current model name (or "Model" placeholder)
- Only interactive (tappable) when `isRpcConnected` is true; otherwise renders as static read-only Badge
- On tap: fetches `GET /api/session/:id/models`, opens a BottomSheet with the list
- Each model in the list is a button (min 44x44pt touch target)
- Active model has a checkmark or highlight (use `accent` variant Badge or similar)
- Selecting a model: sends `PUT /api/session/:id/model`, closes the sheet, updates display
- Loading state while fetching models
- Error handling if fetch fails

Design:
- Use `BottomSheet` from `components/ui`
- Use `Badge` for the trigger (variant `accent` when connected, `default` when read-only)
- Semantic tokens only, dark theme compatible
- Mobile-first: all tap targets ≥ 44x44pt

### Task 5: Integrate ModelSwitcher into SessionDetail header

**File:** `frontend/src/components/SessionDetail.tsx`

Changes:
- Import `ModelSwitcher`
- Determine current model: extract from the last assistant message in `data.entries` (look for the last entry with `message.role === "assistant"` and read `message.model`)
- Add `<ModelSwitcher>` to the header bar, positioned after the "Live" badge (or in the same area)
- Pass `sessionId`, `isRpcConnected`, and `currentModel` as props
- For historical sessions (not RPC-connected), still show the model badge but as non-interactive

The header currently has: Back ← | Title | [Connect/Live] [Files] [Tree] [Collapse]

New layout: Back ← | Title | [ModelBadge] [Connect/Live] [Files] [Tree] [Collapse]

### Task 6: Update feature documentation

**File:** `docs/features/model-switching.md`

Fill in the "Key Files", "Data Flow", and "Key Functions" sections that are currently marked as `{To be filled during implementation.}`.

## Verification

1. **Type check:** `npm run build` must pass with no errors
2. **Tests:** `npm test` must pass, including new model endpoint tests
3. **Manual verification with active session:**
   ```bash
   curl http://localhost:8081/api/session/<id>/models | jq .
   curl -X PUT -H 'Content-Type: application/json' -d '{"model":"claude-3.5-sonnet"}' http://localhost:8081/api/session/<id>/model | jq .
   ```
4. **Frontend verification:**
   - Model badge visible in session detail header
   - Tapping badge opens bottom sheet with model list (when RPC connected)
   - Selecting a model updates the display
   - Badge is non-interactive for historical sessions
   - All touch targets ≥ 44x44pt
   - Dark theme renders correctly

## Acceptance Criteria Mapping

| Criteria | Task |
|----------|------|
| `GET /api/session/:id/models` returns available models | Task 1 |
| `PUT /api/session/:id/model` switches the active model | Task 2 |
| Current model displayed as Badge in session header | Task 4, 5 |
| Tapping model Badge opens BottomSheet with model list | Task 4 |
| Active model visually indicated in the list | Task 4 |
| Model switching only available for RPC-connected sessions | Task 4, 5 |
| Historical sessions show model as read-only metadata | Task 5 |
