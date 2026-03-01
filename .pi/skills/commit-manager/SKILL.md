---
name: commit-manager
description: Manage git commits for Sol. Use this skill to create conventional commits that reference tickets, ADRs, and PRDs.
---

# Commit Manager Skill

This skill ensures that all git commits in the Sol project follow the Conventional Commits specification and properly reference related documentation.

## Requirements

1. **Conventional Commits**: All commit messages MUST follow the conventional commits format:
   `<type>[optional scope]: <description>`
   
   Types allowed:
   - `feat`: A new feature
   - `fix`: A bug fix
   - `docs`: Documentation only changes
   - `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
   - `refactor`: A code change that neither fixes a bug nor adds a feature
   - `perf`: A code change that improves performance
   - `test`: Adding missing tests or correcting existing tests
   - `chore`: Changes to the build process or auxiliary tools and libraries

2. **References**:
   - Every commit MUST reference at least one relevant Ticket, ADR, or PRD in the footer (e.g., `Refs: Ticket-123`, `Related to: ADR-001`).
   - If the user asks to commit but does not provide a ticket, ADR, or PRD reference, you MUST ask the user for justification or the specific reference before creating the commit.

## Workflow

When asked to commit changes:
1. Examine the staged changes (`git diff --cached`) or ask the user to stage them.
2. Determine the appropriate conventional commit type.
3. Check if the user provided a reference (Ticket, ADR, PRD) for the changes.
4. If no reference is provided or the connection is unclear, pause and ask the user: "Please provide the Ticket, ADR, or PRD this commit relates to, or a justification if none exists."
5. Once references are clear, generate a commit message following the format:
   
   ```
   <type>(<scope>): <concise description>

   <detailed body explaining *why* the change was made, not just *what*>

   Refs: Ticket-XXX, ADR-YYY, PRD-ZZZ
   ```
6. Execute the commit using `git commit -m "<message>"`.
