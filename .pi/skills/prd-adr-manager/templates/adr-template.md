# ADR Template

Copy and fill in the template below.

---

```markdown
# ADR {NUMBER}: {Title in Title Case}

**Date:** {YYYY-MM-DD}
**Status:** Proposed | Accepted | Superseded by ADR {N}
**Supersedes:** {If applicable: ADR {N} or "N/A"}

## Context

{Describe the problem or situation that requires a decision.}
{What constraints or requirements exist?}
{Why is the current approach insufficient?}

## Decision

We will implement {high-level decision summary}.

### {Subsection for Details}

{Break down the decision into logical sections.}
{Include specifications, formulas, algorithms as needed.}

### {Another Subsection}

{Continue with additional details.}

## Consequences

### Positive

- {Benefit 1}
- {Benefit 2}

### Negative

- {Drawback 1}
- {Drawback 2}

### Technical

- {Technical impact 1}
- {Technical impact 2}

### Maintainability

- {Impact on code modularity}
- {DRY implications}
- {Testing implications}
```

---

## Checklist

Before finalizing ADR:

- [ ] Title clearly describes the decision
- [ ] Context explains WHY this decision is needed
- [ ] Decision section is detailed enough to implement
- [ ] Consequences cover positive, negative, and technical impacts
- [ ] Maintainability consequences documented
- [ ] Status is set correctly
- [ ] Date is current
- [ ] File name follows pattern: `{number}-{kebab-case-title}.md`
