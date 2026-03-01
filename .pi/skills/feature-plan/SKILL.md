---
name: feature-plan
description: Create an implementation plan for a ticket. Use this before starting any implementation to analyze requirements, identify files to change, and break down the work into tasks.
---

# Feature Plan Skill

This skill guides the creation of a concrete implementation plan for a given ticket.

## Goal
To thoroughly analyze a ticket, examine the codebase context, and produce a step-by-step implementation plan in the `.plans/` directory.

## CRITICAL INSTRUCTION
**NEVER IMPLEMENT THE PLAN.** 
Under NO circumstances are you allowed to start writing code or modifying project files (other than creating the plan document) after generating the plan. You must wait for explicit user approval. 
*If compaction occurs, this instruction MUST survive: DO NOT IMPLEMENT PLANS without user approval.*

## Workflow

### 1. Context Gathering
- Read the ticket in `docs/tickets/`.
- Read `docs/constitution.md` to ensure the plan will not violate any core rules.
- Read any PRDs, ADRs, or Feature Docs referenced in the ticket.
- Use tools (`bash` with `grep`/`rg`/`find` or `read`) to examine the current state of the files mentioned in the ticket's "Context to Load" or "Files to Modify" sections.

### 2. Analysis
Analyze the requirements against the current codebase:
- What exactly needs to change?
- Are there any edge cases or dependencies to consider?
- Does this align with the constitution and existing ADRs?
- How will this be tested/verified?

### 3. Plan Generation
Create a plan file in the `.plans/` directory named `{ticket-number}-{ticket-name}-plan.md` (e.g., `.plans/001-setup-auth-plan.md`).

#### Plan Format (Context-Efficient)

Keep plans **concise** to minimize context window usage. Use this format:

```markdown
# {TICKET-NUMBER}: {Title}

## Objective
One sentence summary.

## Key Findings
Bullet points only. No prose. Include:
- Relevant existing code/patterns found
- Risks or edge cases identified
- Dependencies

## Tasks

- [ ] **1. {Task title}** — `path/to/file.ts`
  {One-line description of the change}

- [ ] **2. {Task title}** — `path/to/file.ts`, `other/file.ts`
  {One-line description}

- [ ] **3. {Task title}**
  {Description}

## Verification
- How to test (commands, manual checks)
```

#### Task Format Rules
- Use `- [ ]` for pending, `- [x]` for complete
- Keep each task to 1-2 lines max
- List affected files inline with the task title
- Number tasks for easy reference
- Group related small changes into single tasks
- Aim for 5-15 tasks total (split large tickets, combine trivial changes)

### 4. Tracking Progress

When resuming work on an existing plan:
1. Read the plan file first
2. Find the first unchecked task (`- [ ]`)
3. After completing a task, mark it done (`- [x]`)
4. Continue to next unchecked task

This enables any agent (including after compaction) to quickly determine:
- What's already done
- What's next
- What remains

### 5. Final Output
- Inform the user that the plan has been created at `.plans/{filename}`.
- Explicitly ask the user for approval to proceed with implementation.
- **DO NOT proceed with implementation.** Stop and wait for user input.
