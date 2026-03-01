# Pre-Study: Sol Design System Backbone

**Date:** 2026-03-01
**Status:** Complete

## Objective
Establish the foundational principles, design language, and best practices for Sol's mobile-first user interface. This system must ensure that all features feel sleek, highly responsive, and native to a mobile device (specifically iPhone Safari) while maintaining consistency across the entire app.

## Inspiration & Industry Best Practices

### 1. Material Design 3 (Google)
- **Tokens & Theming:** Use of design tokens (color, typography, spacing, elevation) to ensure systemic consistency.
- **Adaptive & Expressive:** Fluid layouts that respond to screen sizes, though Sol is primarily mobile-first.
- **Elevation & Depth:** Using shadows and visual layers to communicate hierarchy (e.g., modals, bottom sheets, sticky headers).
- **Accessibility:** Strict adherence to WCAG AA contrast ratios and large touch targets (minimum 48x48dp in Material, though Apple HIG suggests 44x44pt).

### 2. Apple Human Interface Guidelines (HIG)
- **Touch Targets:** Minimum 44x44pt for all interactive elements.
- **Gestures:** Reliance on natural swiping, scrolling, and edge-swipes.
- **Feedback:** Haptic feedback (where possible) and immediate visual state changes (active, hover, disabled).
- **Typography:** San Francisco (SF Pro) optimization, dynamic type scaling.

### 3. Tailwind CSS & Headless UI
- **Utility-First:** Building a strict set of design tokens directly into the `tailwind.config.ts` (or v4 CSS variables).
- **Headless Components:** Separating logic from styling to ensure accessible, unopinionated primitives (Dialogs, Popovers, Tabs) that can be styled exactly to the design system's spec.

## Proposed Core Principles for Sol

1. **Mobile-First & Native Feel:** The app must not feel like a resized desktop website. It should use mobile patterns: bottom navigation (or hidden nav), full-screen modals, bottom sheets for options, and native-feeling scrolling.
2. **Dark Theme Native:** Sol is a developer tool. The primary theme is dark, utilizing deep grays and OLED blacks to reduce eye strain and save battery on mobile devices.
3. **Typography as Hierarchy:** Minimal use of borders. Rely on font weight, size, and text color (primary, secondary, muted) to establish visual hierarchy.
4. **Information Density:** Balance readability with the need to display dense technical information (code blocks, git diffs, JSON).
5. **Fluid Feedback:** Every interaction (tap, send, error) must provide immediate visual feedback.

## Recommended Documents to Create

To formally establish this design system, I propose creating the following documents via the `prd-adr-manager` skill:

1. **PRD Update (or new Feature PRD): `002-design-system.md`**
   - Defines the requirements for the design system (touch targets, color palette, typography scale, component library).
   - Establishes the requirement for dark mode and accessibility standards.

2. **ADR: `006-tailwind-v4-design-tokens.md`**
   - Architectural decision on how design tokens (colors, spacing, fonts) are defined using Tailwind CSS v4's CSS-variable driven configuration.
   - Decision on component architecture (e.g., creating a `components/ui` folder for reusable primitive components built on Headless UI).

3. **Feature Documentation: `docs/features/design-system.md`**
   - A living document acting as the UI kit reference.
   - Details the exact color palette (e.g., `bg-gray-900` for app background, `bg-gray-800` for surface), typography scale, and layout primitives.

---

*End of Pre-Study*