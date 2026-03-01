---
description: Implement a ticket following all project governance (constitution, ADRs, PRD)
---
Implement the following ticket: $@

Before writing any code, you MUST complete this preparation:

1. **Check for a plan**: Look in the `.plans/` directory for a plan corresponding to this ticket.
   - If a plan **DOES NOT EXIST**, you MUST use the `feature-plan` skill to create one first. Do not proceed with implementation until the plan is created and approved by the user.
2. **Read `docs/constitution.md`** — these rules are binding and must never be broken.
3. **Read the ticket** (`docs/tickets/{ticket}.md`) — this is your sole scope of work.
4. **Read every file in the ticket's "Context to Load" section**, in order.
5. **Read all referenced ADRs** — respect their decisions unless marked `Superseded` or `Obsolete`.
6. **Read the referenced PRD sections** in `docs/PRD/001-sol.md`.

Implementation rules:
- **Only implement what the plan and ticket specify.** No unrelated refactors, no scope creep.
- **Respect existing ADR decisions.** If an ADR chose a pattern, library, or approach — use it.
- **Follow AGENTS.md code style** (ESM imports with `.js`, strict types, no `any`, naming conventions).
- **Run the ticket's verification checklist** (`npm run build` at minimum) before declaring done.
- **Update the ticket status** to "In Review" when complete.

When finished, remind the user to run `/feature-review` to validate the implementation.
