# AGENTS.md

## Project

Ledger is the internal PHANTOMS finance platform. It manages projects, budgets, member contributions, withdrawals, approvals, balances, evidence, and financial audit history.

## Core Stack

- Next.js (App Router) + TypeScript
- React Server Components by default
- Server Actions / Route Handlers for mutations and APIs
- Neon PostgreSQL
- Drizzle ORM + Drizzle Kit
- Better Auth
- Cloudflare R2 for transaction evidence
- Zod for runtime validation
- Tailwind CSS + shadcn/ui + Lucide
- Vercel deployment
- GitHub source control

## Non-Negotiable Rules

1. Financial truth lives on the server/database. Never calculate authoritative balances from client state.
2. Never trust client-supplied `user_id`, `organization_id`, `project_id`, role, approval status, or permissions.
3. Every mutation must authenticate the actor and authorize the actor against current database state.
4. A member cannot approve or reject their own transaction.
5. Financial amounts must never use JavaScript floating-point arithmetic. Store money as integer minor units (`amount_minor_units`) or an equivalent exact PostgreSQL numeric type.
6. Transaction approval and its audit event must be atomic.
7. Never hard-delete approved financial transactions. Preserve the ledger history.
8. Evidence files belong in object storage (Cloudflare R2); PostgreSQL stores only metadata/object keys.
9. Never expose secrets, database credentials, Better Auth secrets, or R2 credentials to the client.
10. Do not use `npm audit fix --force` without reviewing the dependency changes first.
11. Do not bypass validation, authorization, or audit logging to make a feature work.
12. Prefer small, composable domain services over giant Server Actions.
13. Server Components are the default. Use Client Components only when interactivity requires them.
14. Do not introduce a new library when an existing dependency or platform capability is sufficient.

## Architecture

Use this dependency direction:

UI
→ Actions / Route Handlers
→ Domain Services
→ Repositories / Drizzle
→ PostgreSQL

Business rules belong in `src/lib/finance/`, not in UI components.

Recommended domains:

- `src/lib/auth/`
- `src/lib/finance/`
- `src/lib/permissions/`
- `src/lib/storage/`
- `src/lib/validation/`

## Financial Rules

For approved transactions:

- Approved Payments = sum of approved PAYMENT transactions
- Approved Withdrawals = sum of approved WITHDRAWAL transactions
- Net Collected = Approved Payments - Approved Withdrawals
- Remaining Budget = Total Budget - Net Collected
- Funding Progress = Approved Payments / Total Budget
- Member Net Contribution = Member Approved Payments - Member Approved Withdrawals
- Member Balance = Member Net Contribution - Target Contribution

Pending and rejected transactions must not affect approved financial totals.

## Transaction Types

`PAYMENT`
- Money paid into/project-related spending ledger.
- Fields include actor/member, amount, paid_to, notes, optional evidence.

`WITHDRAWAL`
- Money taken from project funds.
- Requires approval.
- Approved withdrawals reduce available project funds.

## Roles

### OWNER

Full organization/project/finance control.

### HEAD

Can review and approve/reject transactions but cannot approve their own transaction.

### MEMBER

Can view authorized projects and submit transactions. Cannot approve transactions.

## Database

Expected core tables:

- users
- organizations
- organization_members
- projects
- project_members
- transactions
- audit_logs

Keep Better Auth tables aligned with the project's Drizzle schema/migrations.

## File Organization

Prefer:

```text
src/
  app/
  components/
  actions/
  db/
    schema/
  lib/
    auth/
    finance/
    permissions/
    storage/
    validation/
  types/
```

## Development Workflow

1. Read relevant project documentation before modifying architecture.
2. Inspect existing code before introducing files.
3. Implement the smallest vertical slice.
4. Validate inputs with Zod.
5. Authorize on the server.
6. Add/modify database schema and migration.
7. Add tests for business-critical logic.
8. Run typecheck, lint, tests, and build.
9. Review security implications.
10. Update documentation when behavior or architecture changes.

## Definition of Done

A change is not complete until:

- TypeScript passes.
- Lint passes.
- Relevant tests pass.
- Database migrations are reproducible.
- Authorization is enforced server-side.
- Financial calculations are deterministic.
- Audit behavior is correct where required.
- No secrets are committed.
- Documentation is updated when necessary.
