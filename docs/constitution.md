# Constitution

**Global rules for Sol project. These rules must NEVER be broken.**

1. **Adhere to AGENTS.md**: The `AGENTS.md` file serves as the core foundation for this project. All architectural decisions, tech stack choices, API designs, and frontend guidelines defined within it are strictly binding.
2. **Follow PRD/ADR Workflow**: All technical decisions require an ADR. New features require a PRD update, feature documentation, a feature index update, and a dedicated implementation ticket. Never implement new features without this prior documentation process. Use the `prd-adr-manager` skill (`/feature-create` or `/feature-update`).
3. **Plan Before Implementation**: An implementation plan MUST be created and approved by the user before any code is written or modified for a ticket. Plans must analyze requirements, identify affected files, and outline tasks. Agents must never implement a plan without explicit user approval.
4. **No Unwarranted Side Effects**: Features must only implement the specific behavior outlined in their PRD, ticket, and plan. Do not introduce refactors or unrelated changes that could impact the stability of existing features.
5. **Strict Typing & ESM Integration**: The backend uses Strict TypeScript with ESM (`import`/`export`). Do not use `require()`. Local backend imports must include `.js`. No `any` type without explicit justification.
6. **Robust Error Handling**: Express server processes and RPC subprocesses must not crash due to unhandled exceptions. Subprocesses must be caught and gracefully communicated, and orphaned processes must not be left behind.
7. **Immutable Historical Sessions**: Historical session files are strictly read-only and accessed only via the `@mariozechner/pi-coding-agent` SDK. All active writes happen via the `pi --mode rpc` subprocess. Never modify session files directly.
8. **Mobile-First Design Rules**: All UI components must adhere to the design system (Tailwind v4 CSS variables, dark theme OLED black, minimum 44x44pt touch targets, and use of `components/ui`). Do not hardcode hex values or bypass the `components/ui` primitives.
9. **Security Boundary**: The application assumes network-level security via Tailscale. Do not introduce local authentication systems.
10. **Review Gates**: All feature implementations must pass a thorough review (`/feature-review`) against the implementation ticket, PRDs, ADRs, AGENTS.md, and this Constitution. Features that fail review must have their tickets marked with feedback and must be reworked before acceptance.
