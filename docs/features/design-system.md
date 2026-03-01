# Feature: Design System & UI Kit

## Overview

The Sol Design System provides the strict guidelines, design tokens, and component primitives necessary to build a consistent, sleek, and mobile-native user interface. It is the implementation of [PRD 002](../PRD/002-design-system.md) and [ADR 006](../ADR/006-tailwind-v4-design-tokens.md).

This document acts as a living style guide and reference for the exact design tokens, typography scale, and layout primitives available to developers.

## User Stories

From [PRD 002](../PRD/002-design-system.md):
- "As a developer, I want the UI to feel like a polished native app with snappy navigation so working from my phone doesn't feel like a compromise."
- "As a developer, I want a dark theme with a strong design system so the app is comfortable to read and visually consistent."

## Design Language Principles

1. **OLED-Optimized Dark Theme:** True black (`#000000`) backgrounds to blend with hardware bezels and save battery. Surfaces use elevated grays (`gray-900`, `gray-800`).
2. **Typography as Hierarchy:** Use font weight, size, and text color (primary vs. muted) instead of borders to separate content.
3. **Fluid Feedback:** Every interactive element must provide immediate visual feedback (active/pressed states).
4. **Mobile Ergonomics:** Minimum touch targets of 44x44pt (Apple HIG). Core interactions in the "thumb zone."
5. **Information Density:** Balance legibility with the need to display dense technical text (code, JSON).

## Design Tokens

These tokens should be defined as CSS variables in Tailwind v4 and used consistently across all components.

### 1. Colors (Semantic Mapping)

| Token | Tailwind Class Equivalent | Purpose | Example Hex |
|-------|--------------------------|---------|-------------|
| `--bg-app` | `bg-black` | True OLED background | `#000000` |
| `--surface-1` | `bg-gray-900` | Elevated surfaces (cards, chat bubbles) | `#111827` |
| `--surface-2` | `bg-gray-800` | Highly elevated surfaces (modals, sheets) | `#1f2937` |
| `--text-primary` | `text-gray-50` | High-contrast body text, headings | `#f9fafb` |
| `--text-muted` | `text-gray-400` | Metadata, timestamps, secondary info | `#9ca3af` |
| `--border-subtle` | `border-gray-800` | Dividers only where strictly necessary | `#1f2937` |
| `--accent-primary` | `bg-blue-600` / `text-blue-400` | Primary actions (Send, active tabs) | `#2563eb` |
| `--state-error` | `text-red-400` | Error messages, abort actions | `#f87171` |
| `--state-success` | `text-emerald-400` | Success indicators | `#34d399` |

### 2. Spacing & Sizing

- **Base Unit:** 4px (`spacing-1` in Tailwind)
- **Minimum Touch Target:** `--touch-target: 44px`
- **Standard Layout Margin:** 16px horizontal (`px-4`)
- **Standard Gap:** 8px (`gap-2`)

### 3. Typography Scale

- **Typeface:** System sans-serif (San Francisco on iOS). Monospace for code.

| Level | Size/Weight | Purpose |
|-------|-------------|---------|
| `Title` | Text-lg / Bold | Screen headers, session titles |
| `Body` | Text-base / Regular | Primary reading text (chat messages) |
| `Metadata`| Text-sm / Regular | Timestamps, token counts, file sizes |
| `Code` | Text-sm / Mono | Code snippets, JSON, file paths |

## Component Primitives Library

A dedicated `components/ui` directory handles these primitives, abstracting Headless UI and Tailwind styling.

### Required Primitives:

1. **Button / IconButton:** Enforces the 44px touch target. Includes active states and loading indicators.
2. **Input / Textarea:** Auto-resizing, optimized for mobile keyboards (dictation).
3. **Typography Elements:** Standardized headers, body text, and inline code formatting.
4. **Dialog / Modal:** Full-screen or centered overlay for critical confirmations.
5. **Bottom Sheet:** Slide-up sheet for context menus (model selection, options). Supports drag-to-dismiss and backdrop.
6. **Chat Bubbles:** Distinct styling (padding, borders) for User, Assistant, and Tool messages.
7. **Badges / Tags:** Small, pill-shaped indicators for metadata (model names).
8. **SearchableList:** List with search input, scrollable items, and selection callback. Used by pickers (templates, files, history).
9. **FullScreenOverlay:** Full-viewport modal with safe area insets. Used for intensive editing experiences (Mobile Composer).

## Implementation Rules

1. **Never Hardcode Colors in Features:** Use semantic tokens (`text-muted`, `bg-surface-1`) instead of raw values (`text-gray-400`, `bg-gray-900`) in feature code.
2. **Centralize Interactive Styling:** All hover/active/focus-visible styling belongs in the `components/ui` layer, not scattered across views.
3. **Always Check Touch Targets:** Ensure any clickable element resolves to at least 44x44px. Use padding or specific height utilities to enforce this.

## Implemented Primitives

### SearchableList

A searchable list component with filtering and selection, used by picker sheets.

**Props:**
- `items: SearchableListItem[]` — List items with `id`, `label`, optional `description` and `secondary`
- `onSelect: (item) => void` — Selection callback
- `placeholder?: string` — Search input placeholder
- `emptyMessage?: string` — Message when no items match

**Usage:**
```tsx
<SearchableList
  items={[{ id: "1", label: "Option 1" }]}
  onSelect={(item) => console.log(item.id)}
  placeholder="Search options…"
/>
```

### FullScreenOverlay

A full-viewport modal with safe area insets, used for intensive editing experiences.

**Props:**
- `open: boolean` — Visibility state
- `onClose: () => void` — Close callback
- `children: ComponentChildren` — Overlay content

**Usage:**
```tsx
<FullScreenOverlay open={isOpen} onClose={() => setIsOpen(false)}>
  <div>Full-screen content here</div>
</FullScreenOverlay>
```

### BottomSheet (enhanced)

Slide-up sheet for context menus. Includes drag handle, backdrop, and safe area padding.

**Props:**
- `open: boolean` — Visibility state
- `onClose: () => void` — Close callback
- `title?: string` — Optional header title
- `children: ComponentChildren` — Sheet content

## Current Limitations

1. SearchableList uses simple substring matching (no fuzzy search)
2. BottomSheet doesn't support drag-to-dismiss gesture (closes on backdrop tap or close button)
3. FullScreenOverlay animations are CSS-based only (no gesture-driven dismissal)
4. **Testing limitation**: Components using `@headlessui/react` (BottomSheet, FullScreenOverlay, Dialog) cannot be unit tested in jsdom due to Preact/React compatibility issues with Headless UI's internal hooks. These components should be tested via E2E tests or manual testing on device.
