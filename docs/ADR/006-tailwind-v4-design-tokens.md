# ADR 006: Tailwind v4 Design Tokens & UI Architecture

**Date:** 2026-03-01
**Status:** Accepted
**Supersedes:** N/A

## Context

Sol requires a consistent, sleek, and mobile-native user interface. As established in the Pre-Study for Sol's Design System, maintaining consistency across a highly interactive app demands a systematic approach to colors, typography, spacing, and interactive components.

We have already selected Tailwind CSS v4 and Headless UI (see [ADR 001](001-tech-stack.md)). Tailwind v4 fundamentally changes how configuration works, shifting from a JavaScript `tailwind.config.js` to a CSS-variable driven architecture in a primary `.css` file.

We need to decide how to enforce our design language (OLED-friendly dark mode, Apple HIG minimum 44pt touch targets, typography hierarchy) within this new paradigm.

## Decision

We will implement a CSS-variable driven design token architecture using Tailwind CSS v4, paired with a strict component abstraction layer for UI primitives.

### 1. CSS-Variable Design Tokens

All semantic colors and spacing will be defined as CSS variables and mapped into Tailwind's theme using v4 `@theme` directives in the global CSS file.

- **Colors:** We will define a semantic palette (`--color-surface`, `--color-background`, `--color-primary`, `--color-text-main`, `--color-text-muted`) mapped to specific Tailwind grays/accents. This ensures deep OLED blacks (`bg-black` or `bg-gray-950`) and consistent surfaces without hardcoding raw colors across components.
- **Spacing:** We will introduce a custom spacing token for touch targets (e.g., `--spacing-touch: 44px;` or equivalent `rem` value) mapped as `h-touch` / `w-touch` to enforce Apple HIG minimums.

### 2. UI Primitive Component Layer

Instead of scattering Headless UI logic and Tailwind classes throughout feature views, we will create a dedicated `components/ui` directory.

- **Abstraction:** Every interactive element (Button, IconButton, Dialog, BottomSheet, Input) must be abstracted into a generic UI component.
- **Headless Integration:** Complex primitives (modals, dropdowns) will wrap Headless UI components internally, exposing a clean API to the rest of the app.
- **State Styling:** These primitives will centralize the styling for states (hover, active/pressed, focus-visible) to guarantee the fluid feedback required by the design system.

## Consequences

### Positive

- **Consistency:** Semantic tokens (`bg-surface`, `text-muted`) prevent the "fifty shades of gray" problem.
- **Maintainability:** Updating the base color palette or touch target size requires changing exactly one CSS file.
- **Developer Velocity:** Feature development focuses on layout and data, while UI primitives handle complex accessibility and interaction states.
- **Native Feel:** Enforcing minimum touch targets globally ensures the app feels like a mobile app, not a web page.

### Negative

- **Initial Overhead:** Building the UI primitive layer requires upfront investment before feature work can progress quickly.
- **Abstraction Cost:** Developers must learn and use the internal `components/ui` library instead of writing raw HTML/Tailwind everywhere.

### Technical

- The global stylesheet (e.g., `src/index.css`) will contain the `@theme` block defining custom tokens.
- Tailwind v4 handles the injection of these variables natively without external plugins.

### Maintainability

- Adheres to the component-driven development model native to Preact/React ecosystems.
- Isolates styling logic from business logic (SDK interactions, SSE streaming).
