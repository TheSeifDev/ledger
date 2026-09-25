# CLAUDE

```text
┌──────────────────────────────────────────────┐
│               PHANTOMS FINANCE               │
├──────────────────────────────────────────────┤
│                                              │
│   CLAUDE                                     │
│   Execution Guidance                         │
│                                              │
│   Mission · Rules · Mutation Pattern         │
│   Auth · Database · UI · Commands            │
│                                              │
└──────────────────────────────────────────────┘
```

## 1. Mission

You are working on Ledger, the internal PHANTOMS finance platform.

Optimize for:

```text
├── correctness
├── security
├── financial integrity
├── maintainability
├── simple architecture
└── fast iteration without sacrificing core safeguards
```

Do not optimize for unnecessary abstraction or visual complexity.

## 2. Before Coding

Read in order:

```text
PRD.md
   ↓
ARCHITECTURE.md
   ↓
SECURITY.md
   ↓
CODE_STYLE.md
   ↓
TESTING.md
   ↓
DESIGN_SYSTEM.md   (when changing UI)
```

Inspect existing implementation before creating replacements.

## 3. Execution Environment

Work directly in the current repository checkout.

Do NOT create or switch to a Git worktree unless explicitly requested by the user.

Do NOT move implementation into `.claude/worktrees/`.

The current checkout is the source of truth for:

- code changes
- documentation changes
- validation
- phase reviews

## 4. Coding Rules

```text
├── TypeScript strictness is expected
├── Prefer Server Components
├── Client Components only for browser interactivity
├── Keep business logic outside React components
├── Use Zod at trust boundaries
├── Use Drizzle for database access
├── Keep queries close to their domain/repository layer
├── Centralize permission checks — no duplication
├── Never trust hidden form fields or client state
├── Use exact money representation
├── Never use parseFloat() for financial calculations
├── Avoid `any` — use explicit domain types
├── Prefer named functions for business operations
└── Keep functions focused and testable
```

## 5. Financial Mutation Pattern

Every financial mutation follows:

```text
Authenticate
   ↓
Load current actor/membership
   ↓
Validate input
   ↓
Authorize action
   ↓
Resolve organization scope
   ↓
Load current financial state
   ↓
Apply business rule
   ↓
Persist mutation
   ↓
Write audit event
   ↓
Return safe result
```

Approval/rejection is transactional. The mutation and its audit event commit or roll back together.

## 6. Database Rules

```text
├── Schema changes require Drizzle migrations
├── Never manually modify production tables
├── Never run destructive migrations without review
├── Prefer additive migrations
├── Preserve historical financial records
├── Use foreign keys and constraints where practical
├── Unique constraints for global invariants
└── Scope every financial query by organization_id
```

Multi-tenancy is a schema fact from day one:

```text
One organization exists today.
Every financial row still carries organization_id.
No query proceeds without an organization scope.
```

## 7. Auth Rules

```text
Better Auth owns authentication
        ↓
Application owns authorization
        ↓
Organization/project membership from the database
        ↓
Role resolved server-side
```

- Never accept a role from the client as authoritative.
- A user can only access resources belonging to organizations/projects they are authorized to access.

## 8. UI Rules

Use the existing design system. Do not invent a new visual language for individual screens.

Prioritize:

```text
 1. hierarchy
 2. readability
 3. responsive behavior
 4. accessibility
 5. clear financial states
 6. visual polish
```

## 9. Dependency Rules

Before adding a dependency, ask:

```text
Does Next.js already provide it?
        ↓
Does React already provide it?
        ↓
Does an existing dependency provide it?
        ↓
Is a small local utility enough?
        ↓
Only then: add the dependency
```

Do not use `npm audit fix --force` automatically.

## 10. Commands

Typical validation:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If a script does not exist, do not invent a replacement silently; inspect `package.json` first.

## 11. Output Expectations

When implementing a task:

```text
├── summarize what changed
├── mention important architectural decisions
├── mention validation performed
└── explicitly mention unresolved risks or TODOs
```

## 12. Phase Discipline

The roadmap is executed one phase at a time.

When a phase file is provided:

```text
Read current phase
    ↓
Inspect repository
    ↓
Implement only current phase
    ↓
Validate
    ↓
Report
    ↓
STOP
```

Do NOT automatically continue to the next phase.

Do NOT interpret the existence of later-phase bugs as permission to implement later phases.

If a later-phase issue is discovered:

```text
document it
defer it
continue current phase
```

unless it is a hard blocker for the current phase.

## 13. Worktree Rule

Do not create, switch to, or use Git worktrees during normal implementation.

Only use a worktree when the user explicitly requests one.


