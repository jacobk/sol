# Feature Doc Template

Copy and fill in the template below. Leave Implementation section for implementation agent.

---

```markdown
# {Feature Name}

## Overview

{Brief description of what this feature does and why it exists.}
{1-2 paragraphs maximum.}

## User Stories

From [PRD 001](../PRD/001-sol.md):
- "{User story 1}"
- "{User story 2}"

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/...` | {Description} |

### Data Flow

{Describe how data moves through the system for this feature.}

### Key Functions

{Document important functions and what they do.}

## Rationale

### Design Decisions

{Non-obvious choices and why they were made.}

### ADR References

- [ADR {N}: {Title}](../ADR/{N}-{slug}.md) - {Brief context on relevance}

## Current Limitations

{Known issues or planned improvements.}

1. {Limitation 1}
2. {Limitation 2}
```

---

## Checklist

Before finalizing feature doc:

- [ ] Overview clearly explains what and why
- [ ] User stories reference PRD sections
- [ ] Implementation section has placeholders (for implementation agent)
- [ ] Design decisions explain non-obvious choices
- [ ] ADR references link to relevant decisions
- [ ] Current limitations documented
- [ ] File name follows pattern: `{kebab-case-name}.md`
- [ ] Feature index (`README.md`) updated
