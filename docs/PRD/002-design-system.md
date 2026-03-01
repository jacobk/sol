# PRD 002: Sol Design System Backbone

**Created:** 2026-03-01
**Updated:** 2026-03-01
**Status:** Active

## 1. Vision

Sol is fundamentally a developer tool, but it must feel like a polished, native iOS application when accessed via iPhone Safari. The UI must vanish into the background, prioritizing information density (code, diffs, chat) while remaining perfectly legible and ergonomically sound for one-handed mobile use.

The Sol Design System provides the strict guidelines, design tokens, and component primitives necessary to achieve this. It draws heavily from **Apple Human Interface Guidelines (HIG)** for ergonomics and **Google Material Design 3** for systemic consistency, accessibility, and hierarchy.

## 2. Core Principles

1. **Mobile-First & Native Ergonomics:**
   - The app must not feel like a responsive desktop website.
   - Core interactions must live in the "thumb zone" (bottom half of the screen).
   - Use native-feeling patterns: bottom sheets for menus, full-screen modals for complex flows, and edge-swipe-friendly navigation.

2. **OLED-Optimized Dark Theme:**
   - Sol is exclusively a dark-themed application to reduce eye strain and battery consumption.
   - The deep background must use true black (`#000000`) or near-black to blend with the hardware bezels on OLED screens.
   - Surfaces (cards, sheets, headers) use elevated, lighter grays to establish z-index and depth.

3. **Typography as Hierarchy:**
   - Avoid excessive borders and lines to separate content.
   - Rely strictly on font weight (e.g., Medium vs. Regular), size (e.g., 14px vs. 12px), and color contrast (Primary white vs. Muted gray) to establish visual hierarchy.

4. **Fluid, Immediate Feedback:**
   - Every interactive element (button, list item, tool call toggle) must provide immediate visual feedback upon interaction (active/pressed state).
   - State changes (loading, success, error) must be clearly communicated inline.

5. **Information Density vs. Legibility:**
   - Balance the need to display dense technical information (code blocks, git diffs, JSON payloads) with the requirement that text remains readable on a small screen.
   - Code blocks require robust syntax highlighting and horizontal scrolling, never wrapping.

## 3. Functional Requirements: Design System Foundations

### 3.1 Touch Targets & Accessibility

- **Minimum Touch Target:** All interactive elements (buttons, links, list items) must have a minimum interactive area of `44x44pt`, adhering to Apple HIG.
- **Contrast Ratios:** Text and essential icons must meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text or UI components) against their backgrounds.
- **Focus States:** Visible focus states (`focus-visible`) must be implemented for keyboard navigation, even though the primary target is touch.

### 3.2 Typography Scale

- **Typeface:** System sans-serif (San Francisco on iOS). Monospace (SF Mono/Menlo) for code and file paths.
- **Hierarchy:**
  - `Title`: Large, bold, used for screen headers (e.g., Session Name).
  - `Body`: Primary reading text (e.g., chat messages), legible at arm's length.
  - `Metadata`: Smaller, muted text for timestamps, token counts, and file sizes.
  - `Code`: Legible monospace, slightly smaller than body text to accommodate long lines.

### 3.3 Color Palette & Tokens (Semantic)

- **Background:** True OLED black (`bg-black` or `bg-gray-950`).
- **Surface (Level 1):** Elevated elements like chat bubbles, cards (`bg-gray-900`).
- **Surface (Level 2):** Higher elevated elements like modals, bottom sheets (`bg-gray-800`).
- **Text Primary:** High contrast (`text-gray-50`).
- **Text Secondary/Muted:** Medium contrast for metadata (`text-gray-400`).
- **Borders/Dividers:** Subtle lines only where necessary (`border-gray-800`).
- **Accent/Brand:** A single primary accent color (e.g., a subdued blue or violet) used sparingly for primary actions (Send button, active tabs).
- **Status:** Standard semantic colors adjusted for dark mode (Red for errors/abort, Green for success, Yellow/Amber for warnings).

### 3.4 Spacing & Grid System

- **Base Unit:** 4px grid system (`spacing-1` in Tailwind).
- **Layout Margins:** Standardized screen edge padding (e.g., 16px horizontal).
- **Gap:** Consistent spacing between elements (e.g., 8px between a label and its value).

## 4. Required UI Component Primitives

The design system requires the implementation of a dedicated component library (`components/ui`) built on Headless UI and Tailwind v4 CSS variables.

1. **Buttons & Icon Buttons:** Standardized padding, text styles, active states, and loading states.
2. **Inputs:** Text fields and auto-resizing textareas optimized for mobile keyboards (dictation, autocorrect).
3. **Typography Elements:** Reusable headers, body text, and inline code snippets.
4. **Layout Primitives:** Container, Stack, and Divider.
5. **Overlays:**
   - **Dialog/Modal:** Full-screen or centered modal for critical confirmations.
   - **Bottom Sheet:** Slide-up sheet for context menus, model selection, or options.
6. **Chat Bubbles:** Distinct styling for User, Assistant, Tool Call, and Tool Result messages.
7. **Badges/Tags:** Small, pill-shaped indicators for model names, token counts, or roles.

## 5. Implementation Strategy

- Use **Tailwind CSS v4** to define semantic CSS variables for colors, typography, and spacing (see [ADR 006](../ADR/006-tailwind-v4-design-tokens.md)).
- Build the primitive layer first (`Button.tsx`, `BottomSheet.tsx`) before applying styling to feature views.
- Document the finalized tokens and components in a living style guide (`docs/features/design-system.md`).
