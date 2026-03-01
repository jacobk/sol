# Sol — Frontend Technology Prestudy

**Date:** 2026-03-01
**Author:** Research phase
**Status:** Draft

## Context

Sol is a mobile-first web application that serves as a remote frontend to pi (pi.dev), a CLI-based AI coding agent. It runs on a MacBook and is accessed primarily from an iPhone via Safari over Tailscale VPN. The UI must feel like a polished native app — not a developer tool bolted onto a browser.

Key constraints:
- **Primary target:** iPhone Safari (mobile-first, touch-optimized)
- **Network:** Local/Tailscale — low latency, but not localhost
- **Content types:** Streaming chat, code blocks, markdown, git diffs, file trees
- **Future scope:** Autocomplete dropdowns, command palettes, inline completions
- **Non-goals:** Offline support, public deployment, authentication

---

## 1. Frontend Framework

| Option | Assessment |
|--------|-----------|
| **React 19** | Industry standard with the largest ecosystem. Bundle size is ~40KB min+gz for react + react-dom, acceptable but not small. Every syntax highlighter, markdown renderer, and component library has a React binding. TypeScript support is excellent. |
| **Preact** | API-compatible React alternative at ~4KB min+gz. The `preact/compat` layer lets you use most React libraries unchanged. Occasional edge cases with newer React features (use, Server Components) but irrelevant here since this is a client-only SPA. |
| **Svelte 5** | Compiler-based — ships minimal runtime (~2KB). Produces small, fast output. Ecosystem is smaller: fewer component libraries, syntax highlighter wrappers require manual integration. Runes API (Svelte 5) is stable but newer, fewer examples in the wild. |
| **SolidJS** | Fine-grained reactivity with no virtual DOM, excellent performance. ~7KB runtime. Ecosystem is the smallest of the four — component libraries are limited, and many third-party integrations require manual work. JSX looks like React but semantics differ, which creates footguns. |
| **Vanilla JS** | Zero framework overhead. But building a streaming chat UI, tree visualization, and interactive components without a reactivity model means reinventing state management. Code volume explodes; maintenance cost is high. Appropriate for static pages, not for an interactive app with this complexity. |

### Recommendation: **Preact**

**Rationale:**
- 4KB runtime gives near-vanilla bundle size while providing a real component model and reactivity.
- Full React ecosystem access via `preact/compat` — syntax highlighters (Shiki), markdown renderers (react-markdown), and headless UI libraries all work.
- TypeScript support is first-class (JSX types, hooks, etc.).
- Signals (`@preact/signals`) provide fine-grained reactivity for streaming updates without re-rendering entire chat histories — critical for smooth streaming on mobile Safari.
- Proven mobile Safari compatibility — no known rendering or event handling issues.

**Why not React?** 36KB of extra runtime for no benefit in this use case. We don't need Server Components, Suspense boundaries, or the full React 19 feature set.

**Why not Svelte?** The ecosystem gap is real. We need syntax highlighting, markdown rendering, diff viewing, and eventually command palettes. With Preact, we `npm install` a React library and it works. With Svelte, we write wrapper components for each one.

**Why not SolidJS?** Smallest ecosystem. The JSX-that-isn't-React footgun would slow development for what is primarily a content rendering app, not a reactivity showcase.

### Mobile Safari Gotchas
- Preact's event handling delegates correctly on iOS — no need for the old `cursor: pointer` hack.
- `@preact/signals` avoids the React 18+ `useSyncExternalStore` tearing issues that can cause visual glitches during streaming on Safari.
- Test with iOS Safari's 100vh viewport bug (safe area insets). Use `dvh` units or `env(safe-area-inset-bottom)`.

---

## 2. Component Library / Design System

| Option | Assessment |
|--------|-----------|
| **Tailwind CSS + Headless UI** | Utility-first CSS with unstyled, accessible component primitives (dialogs, menus, listboxes). Dark theme via `dark:` variant or CSS custom properties. Full control over visual design. Headless UI has a Preact-compatible React build. ~4KB for Tailwind runtime (JIT), headless components are tree-shaken. |
| **shadcn/ui** | Copy-paste React components built on Radix primitives + Tailwind. Beautiful defaults, dark theme built in. But tightly coupled to React (not Preact) and Next.js conventions. Would require porting — not a drop-in. |
| **Radix Primitives + Custom CSS** | Unstyled accessible primitives (dialogs, popovers, tooltips). Works with `preact/compat`. But you're writing all styles from scratch — similar effort to Tailwind + Headless UI but without Tailwind's velocity. |
| **DaisyUI** | Tailwind plugin with pre-styled components. Nice dark themes out of the box. But opinionated visual design that's hard to escape — the "DaisyUI look" is recognizable. Touch targets default to desktop sizes. Limited control over interaction patterns. |
| **Custom Design System** | Maximum control, zero dependency. But enormous upfront investment for accessible dialogs, popovers, focus management, and ARIA patterns. Not justified for a single-developer project. |

### Recommendation: **Tailwind CSS v4 + Headless UI**

**Rationale:**
- Tailwind v4 (released 2025) uses a CSS-first config with `@theme` — no JS config file, lightning-fast builds, native CSS cascade layers.
- Dark theme is trivial: define CSS custom properties in `@theme` and toggle a class on `<html>`.
- Touch targets: Tailwind's spacing scale makes it easy to enforce 44×44pt minimum tap targets (Apple HIG). Use `min-h-11 min-w-11` (`44px`) as a project convention.
- Headless UI provides accessible dialog, menu, listbox, combobox, and disclosure components — exactly the primitives needed for command palettes and autocomplete dropdowns.
- Contrast ratios are enforced by choosing your color palette deliberately — Tailwind doesn't help or hinder this. Define a Sol palette in `@theme` with WCAG AA-compliant pairs.
- Total overhead: Tailwind v4 generates only the CSS you use. Headless UI tree-shakes to ~3-8KB per component used.

**Why not shadcn/ui?** It's a React + Next.js ecosystem play. Porting to Preact means maintaining forked components — defeats the purpose of using a library.

**Why not DaisyUI?** The pre-baked visual style fights customization. Sol needs to feel like a bespoke native app, not a themed Bootstrap.

### Mobile Safari Gotchas
- Headless UI dialogs use `inert` attribute for focus trapping — Safari 17.4+ supports this natively.
- Tailwind's `touch-manipulation` utility prevents 300ms tap delay on iOS.
- Use `overscroll-contain` on scrollable panels to prevent Safari's rubber-band scroll from interfering with chat scroll.

### Design System Conventions

Define these in `@theme` and enforce project-wide:

```css
@theme {
  --color-bg-primary: oklch(0.15 0.01 260);
  --color-bg-secondary: oklch(0.20 0.01 260);
  --color-bg-surface: oklch(0.25 0.015 260);
  --color-text-primary: oklch(0.93 0.01 260);
  --color-text-secondary: oklch(0.70 0.02 260);
  --color-accent: oklch(0.75 0.15 200);
  --radius-default: 0.75rem;
  --spacing-touch-min: 2.75rem; /* 44px */
}
```

All interactive elements must meet:
- **WCAG AA contrast:** 4.5:1 for body text, 3:1 for large text / UI components
- **Minimum touch target:** 44×44pt (Apple HIG)
- **Spacing scale:** 4px base (Tailwind default)

---

## 3. Syntax Highlighting

| Option | Assessment |
|--------|-----------|
| **Shiki** | TextMate grammar-based highlighter (same engine as VS Code). Extremely accurate highlighting for 200+ languages. Uses WASM (Oniguruma regex engine). Bundle size is larger (~1-2MB for WASM + grammars), but grammars are lazy-loaded. Themes are VS Code-compatible. No DOM dependency — works with strings. |
| **Prism** | Regex-based, lightweight (~2KB core + per-language grammars). Good enough for most languages. Some edge cases in complex syntax (e.g., JSX, Rust macros). Themes are CSS-based. Easy to integrate. Not actively maintained (last major release 2022). |
| **highlight.js** | Regex-based like Prism, larger default bundle (~30KB for common languages). Good language detection. Similar accuracy limitations to Prism. Actively maintained. CSS themes. |
| **CodeMirror 6 (view-only)** | Full editor framework used in view-only mode. Excellent highlighting via Lezer parser grammars — true parsing, not regex. But heavy (~100-150KB for core + language) and designed for editing, not display. Overkill for read-only code blocks. |

### Recommendation: **Shiki**

**Rationale:**
- VS Code-quality highlighting is a noticeable quality differentiator in a coding tool. When users are reading LLM-generated code on a phone, accurate highlighting reduces cognitive load.
- Lazy-loading: Load only the grammars needed per session. The WASM core is ~700KB but loads once and caches well over Tailscale.
- Shiki outputs plain HTML spans with inline styles — no CSS theme files, no DOM manipulation. This integrates cleanly with streaming: highlight each code block as it completes.
- `shiki` v2 (ESM-first) supports `codeToHtml()` and `codeToTokens()` for flexible rendering.
- Theme: Use `vitesse-dark` or `github-dark-default` as the base, customized to match Sol's palette.

**Why not Prism/highlight.js?** Regex-based highlighting visibly fails on modern TypeScript/JSX/Rust patterns. In a coding agent tool, incorrect highlighting erodes trust in the displayed code.

**Why not CodeMirror?** 10x the bundle size for view-only display. Reserve CodeMirror for if/when Sol adds an editor component.

### Streaming Integration Strategy

LLM responses stream token-by-token. Strategy:
1. Accumulate tokens in a buffer per code block.
2. Apply Shiki highlighting only when the code block is complete (closing ` ``` ` received), OR on a debounced interval (every 300ms) for long code blocks still streaming.
3. During streaming, render the partial code block in a `<pre>` with a monospace font and no highlighting — this avoids re-highlighting on every token.

### Mobile Safari Gotchas
- Shiki's WASM loads fine in Safari 16+. No known issues.
- Inline styles from Shiki mean no CSS specificity battles.
- Long code blocks need `overflow-x: auto` with `-webkit-overflow-scrolling: touch` (still needed on older iOS) for horizontal scrolling.

---

## 4. Markdown Rendering

| Option | Assessment |
|--------|-----------|
| **marked** | Fast, lightweight (~7KB min+gz). GFM support built in. Outputs HTML strings. Extensible via `renderer` overrides — easy to hook in custom code block rendering (Shiki). No JSX integration; you set `innerHTML`. |
| **markdown-it** | ~12KB min+gz. Plugin ecosystem (footnotes, task lists, containers, etc.). GFM via plugins. Also outputs HTML strings. More extensible than marked via plugin API. |
| **remark/rehype (unified)** | AST-based pipeline. Extremely flexible — parse to AST, transform, serialize. `react-markdown` wraps this for React/Preact. ~25-30KB for the full chain. Enables rendering markdown as Preact components (no `dangerouslySetInnerHTML`). |
| **MDX** | Markdown + JSX compilation. Requires a build step and compiler (~50KB+). Designed for authoring content with components, not for rendering arbitrary LLM output at runtime. Wrong tool for this job. |

### Recommendation: **marked**

**Rationale:**
- LLM output is standard markdown with GFM (tables, task lists, fenced code blocks). We don't need remark's AST pipeline or markdown-it's plugin system.
- `marked` is the fastest option and the smallest. For a streaming chat interface on mobile, parse speed matters.
- Code block integration: Override `marked.Renderer.code` to pipe through Shiki. Clean, simple, no AST manipulation needed.
- The `innerHTML` approach is fine here — LLM output is trusted (it comes from our own agent, not user-generated content from the internet). If paranoia is warranted, run `DOMPurify` (~7KB) as a post-pass.
- Toggle between rendered markdown and raw source: store the raw markdown string, swap between `innerHTML` (rendered) and a `<pre>` (raw) on toggle.

**Why not remark/rehype?** 3-4x the bundle size. The AST pipeline is powerful but unnecessary — we're rendering markdown to HTML, not transforming it. `react-markdown` also re-renders the entire tree on every update, which is hostile to streaming performance.

**Why not markdown-it?** Slightly larger, slightly slower, and the plugin system isn't needed. If we later need footnotes or custom containers, markdown-it becomes the right choice. Easy to swap — the API surface is nearly identical.

### Mobile Safari Gotchas
- Tables in GFM markdown need `overflow-x: auto` wrappers for horizontal scroll on narrow screens.
- `marked` outputs standard HTML — no Safari-specific rendering issues.

---

## 5. Diff Viewing

| Option | Assessment |
|--------|-----------|
| **diff2html** | Purpose-built git diff renderer. Parses unified diff format, outputs side-by-side or line-by-line HTML. ~30KB min+gz. Built-in dark theme. Handles large diffs with virtual scrolling option. Actively maintained. |
| **Monaco Diff Editor** | VS Code's diff editor in the browser. Beautiful, feature-rich. But ~2-5MB bundle, designed for desktop, poor mobile touch support, heavy GPU usage. Completely inappropriate for mobile-first read-only viewing. |
| **Custom CSS rendering** | Parse the unified diff ourselves, render `<pre>` blocks with colored lines. Minimal bundle cost. But handling line numbers, word-level diffing, expand/collapse, and large files means reimplementing diff2html poorly. |

### Recommendation: **diff2html**

**Rationale:**
- It does exactly one thing well: render git diffs. The unified diff format from `git diff` drops directly into `diff2html`.
- **Line-by-line mode** (not side-by-side) is the correct default for mobile — side-by-side is unusable on a 390px-wide iPhone screen.
- Built-in highlight.js integration for syntax-aware diffing. We can swap this for Shiki with a custom renderer if the default highlighting isn't good enough.
- ~30KB is a reasonable cost for a complete diff rendering solution.
- Dark theme via CSS custom properties — straightforward to align with Sol's palette.

**Why not Monaco?** It's 50-100x the bundle size and doesn't work well on mobile. Non-starter.

**Why not custom?** Unified diff parsing is surprisingly fiddly (binary files, rename detection, hunk headers). diff2html handles all the edge cases.

### Mobile Safari Gotchas
- Force `line-by-line` mode. Side-by-side requires horizontal scrolling which fights iOS scroll physics.
- Diff lines need sufficient padding for touch selection (users will want to select/copy code from diffs).
- Wrap diff output in a container with `overflow-x: auto` for long lines.

---

## 6. Build Tool

| Option | Assessment |
|--------|-----------|
| **Vite** | Esbuild for dev, Rollup for production. Sub-second HMR. First-class TypeScript and JSX support. Preact integration via `@preactjs/preset-vite`. Massive ecosystem of plugins. The de facto standard for modern frontend projects. |
| **esbuild standalone** | Blazing fast bundler (~10-100x faster than Webpack). But no HMR — only full-page reload on change. Plugin ecosystem is sparse. You'd need to wire up dev server, HTML template, and asset handling manually. |
| **Bun bundler** | Fast, built into the Bun runtime. But still maturing — plugin API is limited, and some edge cases with CSS/asset handling. Couples the project to the Bun runtime. |
| **No build (importmaps)** | Zero build step. Ship ES modules directly to the browser via importmaps. Works in Safari 16.4+. But: no tree-shaking (ship entire libraries), no TypeScript (without a separate step), no CSS processing. Shiki's WASM loading becomes manual. |

### Recommendation: **Vite**

**Rationale:**
- Vite is the obvious, boring, correct choice. It has won the build tool war for SPAs.
- `@preactjs/preset-vite` provides JSX transform, HMR with component state preservation, and aliasing `react` → `preact/compat` — zero config.
- HMR over Tailscale: Vite's WebSocket-based HMR works over network. Configure `server.host: '0.0.0.0'` and `server.hmr.host` to the Tailscale hostname. You can develop with live reload directly on the iPhone.
- Production builds use Rollup — excellent tree-shaking, code splitting, and asset hashing.
- Tailwind CSS v4 has a first-party Vite plugin (`@tailwindcss/vite`).

**Why not esbuild standalone?** No HMR is a dealbreaker for iterating on mobile UI. The DX gap with Vite is enormous.

**Why not no-build?** TypeScript support requires a build step. Tree-shaking Shiki grammars requires a bundler. The current project uses no-build for vanilla JS — the move to Preact + TypeScript + Tailwind necessitates a bundler.

### Note on Current Architecture

The current Sol project runs TypeScript on the **server** via `tsx` with no build step. This prestudy recommends adding Vite for the **frontend only**. The server remains `tsx`-powered with no compilation. The architecture becomes:

```
src/server.ts          → runs via tsx (no build)
frontend/              → built by Vite (dev server proxied, production built to public/)
  src/
    main.tsx
    components/
    ...
  index.html
```

Vite's dev server runs on a different port (e.g., 5173) and proxies `/api/*` to the Express server on 8081. For production, `vite build` outputs to `public/` and Express serves it statically.

### Mobile Safari Gotchas
- Vite's HMR WebSocket needs an explicit `hmr.host` config when accessing from a different device (iPhone → MacBook). Default `localhost` won't resolve.
- Safari aggressively caches — Vite's content-hashed filenames in production handle this.

---

## 7. Real-time Communication

| Option | Assessment |
|--------|-----------|
| **SSE (Server-Sent Events)** | Unidirectional server→client stream over HTTP. Native browser API (`EventSource`). Automatic reconnection built in. Simple to implement on Express. Limited to text data. One connection per event stream. Works through HTTP proxies trivially. |
| **WebSocket** | Bidirectional full-duplex. More complex setup (upgrade handshake, ping/pong). Libraries like `ws` or `Socket.IO` add reconnection, rooms, etc. Overkill for unidirectional streaming. Socket.IO adds ~40KB client-side. |
| **Polling** | Simple HTTP requests on interval. Easy to implement, works everywhere. But latency = polling interval. For streaming token-by-token, you'd need aggressive polling (100ms) which wastes bandwidth and battery, or you batch tokens and lose the streaming feel. |

### Recommendation: **SSE (Server-Sent Events)**

**Rationale:**
- The data flow is inherently unidirectional for streaming: server pushes LLM tokens to client. The client sends prompts via regular `POST` requests. SSE fits this pattern perfectly.
- `EventSource` API is native in all browsers including Safari. No client library needed — zero bundle cost.
- Automatic reconnection with configurable retry interval. If the Tailscale connection hiccups, the browser reconnects without application code.
- Express implementation is trivial: `res.writeHead(200, { 'Content-Type': 'text/event-stream' })`, then `res.write(`data: ${chunk}\n\n`)`.
- Structured events: Use named events (`event: token`, `event: status`, `event: done`) to distinguish message types without parsing.

**Why not WebSocket?** Adds complexity (upgrade handling, keepalive, reconnection logic) for a capability we don't need (client→server streaming). The client sends prompts as HTTP POST — clean REST semantics. Don't mix paradigms for no reason.

**Why not polling?** Streaming LLM output needs <50ms token delivery for a smooth typing effect. Polling at that rate is absurd. SSE delivers tokens the instant they're available.

### Implementation Pattern

```
Client                          Server
  │                               │
  ├── POST /api/prompt ──────────►│  (send user prompt)
  │                               │
  │◄── SSE /api/stream/:id ──────┤  (receive streaming tokens)
  │    event: token               │
  │    data: {"text": "Hello"}    │
  │    ...                        │
  │    event: done                │
  │    data: {}                   │
  │                               │
```

### Mobile Safari Gotchas
- Safari limits concurrent HTTP connections to the same origin to 6. Each SSE stream holds one connection open. With multiple open tabs/streams, you can exhaust the limit. Mitigate by closing SSE connections when the stream is complete (`event: done` → `eventSource.close()`).
- Safari on iOS may throttle background tabs — SSE connections can be suspended when the tab isn't visible. Handle `visibilitychange` events to reconnect on resume.
- `EventSource` doesn't support custom headers (no auth headers). Not an issue for Sol (no auth), but worth noting.

---

## Summary of Recommendations

| Dimension | Choice | Bundle Cost | Key Reason |
|-----------|--------|-------------|------------|
| Framework | **Preact** | ~4KB | React ecosystem at 1/10th the size; signals for streaming |
| Styling | **Tailwind v4 + Headless UI** | ~8-15KB CSS | Full design control, accessible primitives, dark theme trivial |
| Syntax Highlighting | **Shiki** | ~700KB WASM + lazy grammars | VS Code-quality accuracy, inline styles, no CSS conflicts |
| Markdown | **marked** | ~7KB | Fast, small, GFM built-in, easy Shiki integration |
| Diff Viewing | **diff2html** | ~30KB | Purpose-built, line-by-line mobile mode, dark theme |
| Build Tool | **Vite** | N/A (build tool) | HMR, TypeScript, Preact preset, Tailwind plugin |
| Streaming | **SSE** | 0KB (native API) | Unidirectional fit, auto-reconnect, zero client dependency |

**Estimated total JS bundle (production, min+gz):** ~50-60KB excluding Shiki WASM (lazy-loaded separately). This is well within budget for instant load over Tailscale.

---

## Migration Path from Current Architecture

The current Sol frontend is vanilla HTML/CSS/JS in `public/`. Migration strategy:

1. **Phase 1:** Add Vite + Preact alongside the existing frontend. New code lives in `frontend/`. Express serves the Vite-built output. Old `public/` remains until parity.
2. **Phase 2:** Port existing views (session list, session detail, tree) to Preact components. Integrate Tailwind for styling.
3. **Phase 3:** Add Shiki, marked, diff2html for rich content rendering. Implement SSE streaming.
4. **Phase 4:** Remove old `public/` vanilla frontend. Vite output becomes the sole frontend.

Each phase is independently deployable. The API layer (`/api/*`) doesn't change.

---

## Open Questions

1. **Shiki grammar loading strategy:** Preload top-10 languages (TS, JS, Python, Rust, Go, JSON, YAML, Bash, CSS, HTML) at app init, or lazy-load all on first encounter? Preloading ~500KB may be justified over Tailscale.
2. **Conversation tree rendering:** D3.js (~70KB) vs custom SVG/Canvas vs CSS-only nested layout? Needs its own spike based on the tree data structure from `SessionManager.getTree()`.
3. **Virtual scrolling for long sessions:** A session can have hundreds of messages. Options: `@tanstack/virtual` (React-compatible, ~5KB), CSS `content-visibility: auto` (native, Safari 17.4+), or custom intersection observer. Spike after basic chat UI works.
