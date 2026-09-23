# CLAUDE.md

## Mission

You are working on Ledger, the internal PHANTOMS finance platform.

Optimize for:
- correctness
- security
- financial integrity
- maintainability
- simple architecture
- fast iteration without sacrificing core safeguards

Do not optimize for unnecessary abstraction or visual complexity.

## Before Coding

Read:

1. `PRD.md`
2. `ARCHITECTURE.md`
3. `SECURITY.md`
4. `CODE_STYLE.md`
5. `TESTING.md`
6. `DESIGN_SYSTEM.md` when changing UI

Inspect existing implementation before creating replacements.

## Coding Rules

- TypeScript strictness is expected.
- Prefer Server Components.
- Use Client Components only when browser interactivity is necessary.
- Keep business logic outside React components.
- Use Zod at trust boundaries.
- Use Drizzle for database access.
- Keep database queries close to their domain/repository layer.
- Do not duplicate authorization logic in multiple places; centralize permission checks.
- Do not trust hidden form fields or client state for authorization.
- Use exact money representation.
- Never use `parseFloat()` for financial calculations.
- Avoid `any`; use explicit domain types.
- Prefer named functions for important business operations.
- Keep functions focused and testable.

## Financial Mutation Pattern

Every financial mutation should follow:

```text
Authenticate
→ Load current actor/membership
→ Validate input
→ Authorize action
→ Load current financial state
→ Apply business rule
→ Persist mutation
→ Write audit event
→ Return safe result
```

Approval/rejection should be transactional.

## Database Rules

- Schema changes require Drizzle migrations.
- Never manually modify production tables.
- Never run destructive migrations against production without explicit review.
- Prefer additive migrations.
- Preserve historical financial records.
- Use foreign keys and database constraints where practical.
- Add unique constraints for invariants that must be globally enforced.

## Auth Rules

- Better Auth owns authentication.
- Application authorization is separate from authentication.
- Organization/project permissions are determined from database membership.
- Never accept a role from the client as authoritative.
- A user can only access resources belonging to organizations/projects they are authorized to access.

## UI Rules

Use the existing design system. Do not invent a new visual language for individual screens.

Prioritize:
1. hierarchy
2. readability
3. responsive behavior
4. accessibility
5. clear financial states
6. visual polish

## Dependency Rules

Before adding a dependency, ask whether:
- Next.js already provides the capability,
- React already provides the capability,
- an existing project dependency provides it,
- a small local utility is enough.

Do not use `npm audit fix --force` automatically.

## Commands

Typical validation:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If a script does not exist, do not invent a replacement silently; inspect `package.json` first.

## Output Expectations

When implementing a task:
- summarize what changed,
- mention important architectural decisions,
- mention validation performed,
- explicitly mention unresolved risks or TODOs.
