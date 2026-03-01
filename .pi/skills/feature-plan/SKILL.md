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

The plan must include:
- **Title**: Ticket number and name
- **Objective**: Brief summary of what the plan achieves
- **Analysis**: Summary of your investigation (what exists, what needs changing, potential risks/edge cases)
- **Step-by-Step Tasks**: A logical sequence of implementation tasks. Each task should be specific, mentioning target files and the nature of the change.
- **Verification**: How to verify the implementation works and meets acceptance criteria.

### 4. Final Output
- Inform the user that the plan has been created at `.plans/{filename}`.
- Explicitly ask the user for approval to proceed with implementation.
- **DO NOT proceed with implementation.** Stop and wait for user input.
