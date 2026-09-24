# AGENTS

```text
┌──────────────────────────────────────────────┐
│               PHANTOMS FINANCE               │
├──────────────────────────────────────────────┤
│                                              │
│   AGENTS                                     │
│   Coding-Agent Instructions                  │
│                                              │
│   Stack · Non-Negotiables · Domains          │
│   Financial Rules · Workflow · Done          │
│                                              │
└──────────────────────────────────────────────┘
```

## Project

Ledger is the internal PHANTOMS finance platform. It manages projects, budgets, member contributions, withdrawals, approvals, balances, evidence, and financial audit history.

## 1. Core Stack

```text
Next.js (App Router) + TypeScript
        ↓
Neon PostgreSQL + Drizzle ORM + Drizzle Kit
        ↓
Better Auth
        ↓
Cloudflare R2 (transaction evidence)
        ↓
Zod · Tailwind CSS · shadcn/ui · Lucide
        ↓
Vercel · GitHub
```

- React Server Components by default
- Server Actions / Route Handlers for mutations and APIs

## 2. Non-Negotiable Rules

```text
 1. Financial truth lives on the server/database.
    Never calculate authoritative balances from client state.

 2. Never trust client-supplied user_id, organization_id,
    project_id, role, approval status, or permissions.

 3. Every mutation must authenticate the actor and
    authorize the actor against current database state.

 4. A member cannot approve or reject
    their own transaction.

 5. Financial amounts must never use JavaScript
    floating-point arithmetic. Store money as integer
    minor units (amount_minor_units) or an equivalent
    exact PostgreSQL numeric type.

 6. Transaction approval and its audit event
    must be atomic.

 7. Never hard-delete approved financial transactions.
    Preserve the ledger history.

 8. Evidence files belong in object storage (Cloudflare R2).
    PostgreSQL stores only metadata/object keys.

 9. Never expose secrets, database credentials,
    Better Auth secrets, or R2 credentials to the client.

10. Do not use `npm audit fix --force` without reviewing
    the dependency changes first.

11. Do not bypass validation, authorization, or audit
    logging to make a feature work.

12. Prefer small, composable domain services over
    giant Server Actions.

13. Server Components are the default. Use Client
    Components only when interactivity requires them.

14. Do not introduce a new library when an existing
    dependency or platform capability is sufficient.

15. Every query that touches financial data is scoped
    by organization_id. Multi-tenant from day one.
```

## 3. Architecture

Use this dependency direction:

```text
UI
→ Actions / Route Handlers
→ Domain Services
→ Repositories / Drizzle
→ PostgreSQL
```

Business rules belong in `lib/finance/`, not in UI components.

Recommended domains:

```text
lib/
├── auth/
├── finance/
├── permissions/
├── storage/
└── validation/
```

## 4. Financial Rules

For approved transactions:

```text
Approved Payments
= sum of approved PAYMENT transactions

Approved Withdrawals
= sum of approved WITHDRAWAL transactions

Net Collected
= Approved Payments - Approved Withdrawals

Remaining Budget
= Total Budget - Net Collected

Funding Progress
= Approved Payments / Total Budget

Member Net Contribution
= Member Approved Payments - Member Approved Withdrawals

Member Balance
= Member Net Contribution - Target Contribution
```

```text
PENDING and REJECTED never affect approved totals.
```

## 5. Transaction Types

```text
PAYMENT
├── Money paid into/project-related spending ledger
└── Fields: actor/member, amount, paid_to, notes,
    optional evidence

WITHDRAWAL
├── Money taken from project funds
├── Requires approval
└── Approved withdrawals reduce available project funds
```

## 6. Roles

```text
OWNER
    ↓
Full organization/project/finance control

HEAD
    ↓
Review and approve/reject transactions
Cannot approve their own transaction

MEMBER
    ↓
View authorized projects
Submit transactions
Cannot approve transactions
```

## 7. Database

Expected core tables:

```text
users
organizations
organization_members
projects          (organization_id)
project_members   (organization_id)
transactions      (organization_id)
audit_logs        (organization_id)
```

```text
Multi-tenant from day one.
Single organization in practice.
organization_id is mandatory on every financial row.
```

Keep Better Auth tables aligned with the project's Drizzle schema/migrations.

## 8. File Organization

Prefer:

```text
app/            # route orchestration (App Router, route handlers)
src/
  components/   # reusable UI
lib/            # domain/server utilities
db/             # Drizzle client, schema, migration guards
  schema/
tests/
e2e/
```

## 9. Development Workflow

```text
 1. Read relevant project documentation
 2. Inspect existing code before introducing files
 3. Implement the smallest vertical slice
 4. Validate inputs with Zod
 5. Authorize on the server
 6. Add/modify database schema and migration
 7. Add tests for business-critical logic
 8. Run typecheck, lint, tests, and build
 9. Review security implications
10. Update documentation when behavior/architecture changes
```

## 10. Definition of Done

A change is not complete until:

```text
├── TypeScript passes
├── Lint passes
├── Relevant tests pass
├── Database migrations are reproducible
├── Authorization is enforced server-side
├── Queries are organization-scoped
├── Financial calculations are deterministic
├── Audit behavior is correct where required
├── No secrets are committed
└── Documentation is updated when necessary
```
