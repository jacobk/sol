---
name: prd-adr-manager
description: Manage PRDs, ADRs, and feature documentation for Sol. Use when explaining a new feature, proposing a change to an existing feature, or when the user mentions ADR, PRD, feature documentation, or product requirements.
---
# PRD/ADR Manager

This skill guides you through documenting features and decisions. It does NOT handle implementation - only documentation artifacts.

## Quick Reference

| Document | Location | When to Update |
|----------|----------|----------------|
| ADR | `docs/ADR/###-name.md` | New technical decisions (libraries, patterns, architecture) |
| PRD | `docs/PRD/001-sol.md` | User stories, functional requirements |
| Feature Doc | `docs/features/{name}.md` | Implementation details, rationale |
| Feature Index | `docs/features/README.md` | When adding new feature docs |
| Ticket | `docs/tickets/{NNN}-{name}.md` | After documenting new/changed features |

---

## Maintainability Mindset

Every feature and change is an opportunity to improve code quality. When documenting work, always consider:

- **Refactoring opportunities** - Is this a good time to consolidate related logic?
- **DRY violations** - Does similar logic exist elsewhere that should be unified?
- **Modularity** - Can this be designed for easy testing and reuse?
- **Technical debt** - Will this change create or reduce debt?

These considerations should surface in ADRs, tickets, and feature docs—not be an afterthought.

---

## Workflow Selection

**New Feature** - Use when adding entirely new capability:
- Jump to [New Feature Workflow](#new-feature-workflow)

**Feature Change** - Use when modifying existing behavior:
- Jump to [Feature Change Workflow](#feature-change-workflow)

---

## New Feature Workflow

### Step 1: Gather Information

Ask the user the following questions (use structured choices for Yes/No, conversational for open-ended):

1. **Feature Name & Purpose**
   > "What is the feature name and what problem does it solve?"

2. **User Stories**
   > "Who is the target user? What user stories does this address?"
   > Format: "As a [user], I want to [action] so that [benefit]"

3. **Functional Requirements**
   > "What are the key functional requirements? What should this feature do?"

4. **Technical Decision Check** (Yes/No)
   > "Does this require a significant technical decision?"
   > Examples: new library, new pattern, API design, data model change
   > If Yes → Will need an ADR

5. **Existing Feature Impact** (Yes/No)
   > "Will this change any existing feature behavior?"
   > If Yes → Also run Feature Change Workflow for affected features

### Step 2: Determine Documents Needed

Based on answers:
- **Always**: Update PRD, create Feature Doc, update Feature Index
- **If technical decision**: Create new ADR
- **If affects existing**: Update existing Feature Docs

### Step 3: Create/Update Documents

#### 3a. Create ADR (if needed)

1. Check next ADR number: `ls docs/ADR/`
2. Create `docs/ADR/{next-number}-{kebab-case-name}.md`
3. Use template from [templates/adr-template.md](templates/adr-template.md)
4. Fill in: Context, Decision (detailed), Consequences
5. Include maintainability impact

#### 3b. Update PRD

1. Read `docs/PRD/001-sol.md`
2. Add user stories to **Section 2** (under appropriate subsection)
3. Add functional requirements to **Section 3** (create new subsection if needed)
4. If post-MVP, add to **Section 5: Future Considerations**

#### 3c. Create Feature Doc

1. Create `docs/features/{feature-name}.md`
2. Use template from [templates/feature-template.md](templates/feature-template.md)
3. Fill in: Overview, User Stories references, Rationale, ADR References
4. **Leave Implementation section as placeholder** - implementation agent fills this

#### 3d. Update Feature Index

1. Edit `docs/features/README.md`
2. Add row to Feature Index table with status "Planned" or "In Progress"

#### 3e. Create Implementation Ticket

1. Check next ticket number: `ls docs/tickets/`
2. Create `docs/tickets/{next-number}-{feature-name}.md`
3. Use template from [templates/ticket-template.md](templates/ticket-template.md)
4. Fill in: Context files to load, Implementation checklist, Acceptance criteria
5. List specific files to modify based on feature doc
6. **Do NOT duplicate ADR/PRD content** - only reference them
7. Identify refactoring scope and testing requirements

### Step 4: Summary

Provide summary listing:
- All files created/modified
- Implementation ticket created (with ticket number)
- What sections implementation agent needs to complete
- Any follow-up decisions needed

---

## Feature Change Workflow

### Step 1: Identify Feature

Ask the user which existing feature is being changed. Offer options from `docs/features/README.md`.

### Step 2: Gather Change Details

1. **What is Changing**
   > "What specific aspect of [feature] is changing?"

2. **Why the Change**
   > "Why is this change needed? What problem does it solve?"

3. **ADR Impact** (Yes/No)
   > "Does this change affect any technical decisions in existing ADRs?"
   > If Yes → Ask which ADR, determine if supersede or update

4. **Breaking Change** (Yes/No)
   > "Is this a breaking change to existing behavior?"
   > If Yes → Document migration/compatibility notes

### Step 3: Determine Documents to Update

- **Always**: Update Feature Doc, may update PRD
- **If ADR affected**: Update ADR status or create new superseding ADR
- **If breaking**: Add compatibility notes to all affected docs

### Step 4: Update Documents

#### 4a. Handle ADR Changes

**If superseding an ADR:**
1. Update old ADR: `**Status:** Superseded by ADR {new-number}`
2. Create new ADR with `**Supersedes:** ADR {old-number}`

**If minor ADR update:**
1. Add note to existing ADR under new "Updates" section
2. Keep Status as "Accepted"

#### 4b. Update PRD

1. Find relevant section in `docs/PRD/001-sol.md`
2. Update user stories or requirements as needed
3. Add "(Updated: YYYY-MM-DD)" to section header if significant change

#### 4c. Update Feature Doc

1. Edit `docs/features/{feature-name}.md`
2. Update Overview if scope changed
3. Update Rationale with new design decisions
4. Update ADR References if new/changed ADRs
5. Add to Current Limitations if introducing known issues
6. Mark Implementation sections for update

#### 4d. Create Implementation Ticket

1. Check next ticket number: `ls docs/tickets/`
2. Create `docs/tickets/{next-number}-{feature-name}.md`
3. Use template from [templates/ticket-template.md](templates/ticket-template.md)
4. Reference the new/updated ADR and PRD sections
5. List implementation tasks derived from the changes

### Step 5: Summary

Provide summary listing:
- All files modified
- What ADRs were affected and how
- Implementation ticket created (with ticket number)
- What implementation agent needs to update

---

## Important Reminders

- **Maintainability first** - Every ticket and ADR must address refactoring opportunities, DRY violations, and modularity
- **No implementation analysis** - This skill documents WHAT and WHY, not HOW
- **Leave placeholders** - Implementation sections are filled by implementation agent
- **Link ADRs** - Always reference relevant ADRs in feature docs
- **Date stamps** - Use format YYYY-MM-DD for dates
- **Kebab-case** - File names use lowercase with hyphens
- **Always create tickets** - Every new feature or change needs an implementation ticket
- **Tickets reference, don't repeat** - Link to ADR/PRD sections, don't duplicate content
