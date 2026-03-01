---
description: Review all pending changes based on tickets, PRDs, ADRs, AGENTS.md, and docs/constitution.md
---
Review all pending changes for the current feature/ticket: $@

Follow these review steps strictly:
1. Compare the implementation against the implementation ticket.
2. Verify that the changes align with existing project PRDs and ADRs, ensuring no unwanted changes are introduced. If unwanted changes are detected, mark the ticket as not passing review and update the ticket with specific review feedback so the implementation can be adjusted.
3. Verify that the feature is fully compliant with the project guidelines in AGENTS.md.
4. Verify that the global rules defined in docs/constitution.md are not broken. These rules must NEVER be broken.

If the implementation fails any step, provide detailed feedback in the ticket and do not consider the feature complete.