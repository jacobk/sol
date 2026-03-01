# Ticket Template

Copy and fill in the template below.

---

```markdown
# TICKET-{NNN}: {Title}

**Related:** ADR {N}, PRD Section {X.Y}
**Feature:** {Feature Name from docs/features/}
**Status:** Ready for Implementation
**Created:** {YYYY-MM-DD}

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/{nnn}-{name}.md` - {Brief description}
2. `docs/PRD/001-sol.md` Section {X.Y} - {Brief description}
3. `docs/features/{feature-name}.md` - Current implementation details
4. `src/{path/to/main/file}` - Main file to modify

## Implementation Checklist

### 1. {First Task}

{Brief description of what to do. Reference ADR section if applicable.}

### 2. {Second Task}

{Brief description.}

### 3. {Third Task}

{Brief description.}

## Maintainability

Before implementing, review for:

- [ ] **Refactor opportunity?** Related code that should be consolidated
- [ ] **DRY check** - Similar logic elsewhere to unify
- [ ] **Modularity** - Can new code be isolated for testing/reuse?
- [ ] **Debt impact** - Does this create or reduce technical debt?

**Specific refactoring tasks:**
{Document specific refactoring or cleanup tasks discovered during planning}

## Testing Requirements

### Verification Checklist

Implementation agent MUST run before marking complete:
```bash
npm run build  # Must pass
npm run lint   # Must pass
```

## Acceptance Criteria

- [ ] {Criterion 1 - verifiable outcome}
- [ ] {Criterion 2}
- [ ] {Criterion 3}

## Files to Modify

| File | Change |
|------|--------|
| `src/path/to/file.ts` | {What changes} |
| NEW: `src/path/to/new-file.ts` | {Purpose of new file} |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- {Any other implementation notes}
```

---

## Checklist

Before finalizing ticket:

- [ ] Ticket number is sequential (check `ls docs/tickets/`)
- [ ] Related ADR and PRD sections are specified
- [ ] Context files list is complete and ordered by importance
- [ ] Implementation tasks are specific and actionable
- [ ] Acceptance criteria are verifiable (not vague)
- [ ] Files to modify list includes both existing and new files
- [ ] No content is duplicated from ADR/PRD (only references)
- [ ] Maintainability section reviewed
- [ ] Verification checklist included
