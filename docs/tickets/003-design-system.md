# TICKET-003: Design System & UI Primitives

**Related:** ADR 006, PRD 002
**Feature:** [Design System & UI Kit](../features/design-system.md)
**Status:** In Review
**Created:** 2026-03-01

## Context to Load

1. `docs/ADR/006-tailwind-v4-design-tokens.md` - CSS variable architecture decision
2. `docs/PRD/002-design-system.md` - Full design system requirements
3. `docs/features/design-system.md` - Design tokens reference and component list
4. `frontend/src/index.css` - Global stylesheet (from TICKET-001)

## Implementation Checklist

### 1. Define semantic CSS variable tokens

In the global stylesheet (`frontend/src/index.css`), define the full `@theme` block with all semantic tokens from the design system feature doc: colors (`--bg-app`, `--surface-1`, `--surface-2`, `--text-primary`, `--text-muted`, `--accent-primary`, etc.), spacing (`--touch-target: 44px`), and any custom Tailwind utilities (e.g., `h-touch`, `bg-surface-1`).

### 2. Create typography primitives

Build reusable Preact components for the typography scale: Title, Body, Metadata, Code. These enforce consistent font sizes, weights, and colors per the design system spec.

### 3. Create layout primitives

Build Stack (vertical/horizontal flex with consistent gap), Divider, and Container components. These enforce the 4px grid system and standard layout margins (16px horizontal).

### 4. Create interactive primitives

Build the core interactive components using Headless UI where applicable:
- **Button / IconButton** — enforces 44px minimum touch target, active/pressed states, loading state
- **Input / Textarea** — mobile keyboard optimized (autocorrect, dictation), auto-resizing textarea
- **Dialog / Modal** — full-screen on mobile, centered on larger screens, uses Headless UI
- **Bottom Sheet** — slide-up pane for context menus, uses Headless UI or native dialog

### 5. Create chat-specific primitives

Build Chat Bubble components with distinct styling for User, Assistant, Tool Call, and Tool Result messages. Build Badge/Tag components for model names, token counts, and roles.

### 6. Verify on iPhone Safari

Test all primitives on iPhone Safari over Tailscale. Verify: 44px touch targets, fluid active/pressed feedback, correct dark theme rendering, no layout issues.

## Maintainability

- [ ] **Modularity** — All primitives in `frontend/src/components/ui/`, cleanly separated from feature components
- [ ] **DRY check** — All color values must come from CSS variables, never hardcoded in components

**Specific refactoring tasks:** None — greenfield. Establish the pattern that all subsequent feature components import from `components/ui/`.

## Testing Requirements

### Verification Checklist

```bash
npm run build          # tsc --noEmit must pass
npm run build:frontend # Vite build succeeds
```

Manual verification: open on iPhone Safari, test every primitive's touch interaction.

## Acceptance Criteria

- [ ] Tailwind v4 `@theme` block defines all semantic color, spacing, and sizing tokens
- [ ] `frontend/src/components/ui/` contains: Button, IconButton, Input, Textarea, Dialog, BottomSheet, Stack, Divider, Badge, ChatBubble, and typography components
- [ ] All interactive components meet 44x44px minimum touch target
- [ ] All components use semantic tokens (no hardcoded colors)
- [ ] Active/pressed states provide fluid visual feedback
- [ ] Components render correctly on iPhone Safari (dark theme, OLED black background)

## Files to Modify

| File | Change |
|------|--------|
| MODIFY: `frontend/src/index.css` | Full `@theme` block with all design tokens |
| NEW: `frontend/src/components/ui/Button.tsx` | Button and IconButton primitives |
| NEW: `frontend/src/components/ui/Input.tsx` | Input and Textarea primitives |
| NEW: `frontend/src/components/ui/Dialog.tsx` | Modal/Dialog primitive (Headless UI) |
| NEW: `frontend/src/components/ui/BottomSheet.tsx` | Bottom sheet primitive |
| NEW: `frontend/src/components/ui/Layout.tsx` | Stack, Divider, Container |
| NEW: `frontend/src/components/ui/Typography.tsx` | Title, Body, Metadata, Code |
| NEW: `frontend/src/components/ui/ChatBubble.tsx` | Chat message styling by role |
| NEW: `frontend/src/components/ui/Badge.tsx` | Badge/Tag for metadata |
| NEW: `frontend/src/components/ui/index.ts` | Barrel export for all primitives |
