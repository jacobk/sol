---
description: Analyze review feedback in the ticket you just implemented and fix issues
---
Look at the **Review Feedback** section at the bottom of the ticket you just implemented (`docs/tickets/{ticket}.md`). The `/review-feature` process appends feedback directly into the ticket file.

Follow these steps:

1. **Re-read the ticket file** you implemented — scroll to the "Review Feedback" section at the end.
2. **For each issue listed**, analyze whether it is valid by checking against the referenced rule (constitution, AGENTS.md, ADR, PRD, or ticket spec).
3. **Fix all valid issues.** Apply minimal, surgical fixes — do not refactor unrelated code.
4. **If an issue is unclear or you disagree**, ask the user for clarification before changing anything.
5. **Run the verification checklist** again (`npm run build` at minimum) after all fixes.
6. **Do NOT update the ticket status** — leave it for the next review cycle.

Remember: the feedback lives **inside the ticket file itself**, not in a separate file or the chat history.
