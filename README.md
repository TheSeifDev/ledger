# LEDGER

```text
┌──────────────────────────────────────────────────────────────┐
│                        PHANTOMS FINANCE                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   L E D G E R                                                │
│   Internal Team Finance Platform                             │
│                                                              │
│   Projects · Budgets · Members                               │
│   Transactions · Approvals · Audit                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Ledger is the internal finance and project ledger for **PHANTOMS**.

It centralizes:

```text
Projects
Budgets
Members
Payments
Withdrawals
Approvals
Balances
Evidence
Audit History
```

Ledger is an internal application. It is not a banking platform, payment processor, payroll system, or public accounting platform.

---

# 1. Positioning

```text
PHANTOMS Finance
       ↓
Internal Team Finance Platform
       ↓
Multi-Organization SaaS
       ↑
Future — not now
```

The database is **multi-tenant from day one**.

The product is currently:

```text
One organization
One team
No billing
No subscriptions
No org-switching UX
No SaaS administration
```

The schema is designed so future multi-organization expansion does not require structural database surgery.

---

# 2. Architecture

Ledger is a full-stack Next.js application.

```text
Browser
   ↓
Next.js App Router
   │
   ├── Server Components
   ├── Client Components
   ├── Server Actions
   └── Route Handlers
          ↓
   Server Services / Domain
          ↓
      Repositories
          ↓
      Drizzle ORM
          ↓
   Neon PostgreSQL
```

Supporting services:

```text
Better Auth
    → authentication + sessions

Cloudflare R2
    → private transaction evidence

Vercel
    → deployment
```

## Core Philosophy

```text
PostgreSQL      = Financial Truth
R2              = File Bytes
Next.js         = Application Runtime
Finance Domain  = Business Rules
Better Auth     = Authentication
Authorization   = Server-Side Security
Audit Log       = Accountability
React           = Presentation
```

---

# 3. Repository Structure

The project intentionally uses **root-level `app/`, `components/`, and `lib/`**.

```text
ledger/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (app)/
│   │   ├── dashboard/
│   │   ├── projects/
│   │   │   └── [slug]/
│   │   │       ├── page.tsx
│   │   │       ├── transactions/
│   │   │       ├── members/
│   │   │       └── settings/
│   │   ├── pending/
│   │   └── settings/
│   ├── api/
│   │   └── auth/
│   │       └── [...all]/
│   ├── robots.ts
│   ├── sitemap.ts
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── ui/
│   ├── auth/
│   ├── dashboard/
│   ├── projects/
│   ├── transactions/
│   ├── members/
│   └── layout/
│
├── lib/
│   ├── auth/
│   ├── finance/
│   ├── permissions/
│   ├── storage/
│   ├── validation/
│   ├── rate-limit/
│   ├── seo/
│   ├── observability/
│   └── utils/
│
├── src/
│   ├── actions/
│   ├── db/
│   │   ├── schema/
│   │   └── migrations/
│   ├── server/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── guards/
│   └── types/
│
├── public/
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── ...
```

## Important

Do **not** move:

```text
app/
components/
lib/
```

into:

```text
src/
```

This is intentional.

---

# 4. Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router + TypeScript |
| UI | React + Tailwind CSS + shadcn/ui + Lucide |
| Typography | Alexandria |
| Database | Neon PostgreSQL |
| ORM | Drizzle ORM + Drizzle Kit |
| Authentication | Better Auth |
| Validation | Zod |
| Files | Cloudflare R2 |
| Deployment | Vercel |
| Source Control | GitHub |

---

# 5. Authentication Model

Ledger has **no public registration**.

Users are provisioned before they can log in.

```text
Pre-provisioned User
        ↓
/login
        ↓
Email + Password
        ↓
Better Auth
        ↓
Session
        ↓
Protected Application
```

There is no:

```text
/signup
/register
automatic account creation
```

Authentication and authorization are separate concerns.

---

# 6. Product Flow

```text
User Login
    ↓
Dashboard
    ↓
Project
    ↓
Payment / Withdrawal
    ↓
PENDING
    ↓
Owner / Head Review
    ├── APPROVED
    │      ↓
    │   Financial Ledger
    │      ↓
    │   Updated Balances
    │      ↓
    │   Audit Event
    │
    └── REJECTED
           ↓
        History
```

---

# 7. Core Product Pages

```text
PUBLIC
/
 /login

APP
/dashboard
/projects
/projects/[slug]
/projects/[slug]/transactions
/projects/[slug]/members
/projects/[slug]/settings
/pending
/settings
```

Important interaction surfaces:

```text
Create Project
Edit Project

Add Payment
Add Withdrawal

Transaction Details
Approve
Reject

Add Member
Remove Member

Evidence Preview
```

---

# 8. Core Roles

| Role | Access |
|---|---|
| OWNER | Full organization/project/finance control |
| HEAD | Review and approve/reject eligible transactions |
| MEMBER | View authorized projects and submit permitted transactions |

```text
A user cannot approve or reject their own transaction.
```

UI role checks are only for UX.

Server-side authorization is authoritative.

---

# 9. Organization Model

Current product:

```text
PHANTOMS
   ↓
Projects
```

Database:

```text
organizations
    │
    ├── organization_members
    │
    └── projects
          ├── project_members
          └── transactions
```

Every tenant-owned financial query must be organization-scoped.

At minimum:

```text
projects
project_members
transactions
audit_logs
```

must be organization-resolvable.

---

# 10. Financial Model

## Transaction Types

```text
PAYMENT
WITHDRAWAL
```

## Transaction States

```text
PENDING
APPROVED
REJECTED
```

## Project

For approved transactions:

```text
Approved Payments
= SUM(PAYMENT where APPROVED)

Approved Withdrawals
= SUM(WITHDRAWAL where APPROVED)

Net Collected
= Approved Payments - Approved Withdrawals

Remaining Budget
= Total Budget - Net Collected

Funding Progress
= Approved Payments / Total Budget
```

## Member

```text
Net Contribution
= Approved Payments - Approved Withdrawals

Balance
= Net Contribution - Target Contribution
```

```text
PENDING and REJECTED never affect approved financial totals.
```

---

# 11. Money Representation

Financial amounts must be exact.

Preferred:

```text
amount_minor_units INTEGER
```

Example:

```text
750.00 EGP
    ↓
75000
```

Do not use JavaScript floating-point arithmetic for authoritative financial calculations.

---

# 12. Approval Model

Approval is an atomic database workflow:

```text
BEGIN
 ↓
Verify transaction is PENDING
 ↓
Verify actor permission
 ↓
Verify actor != submitter
 ↓
Update transaction
 ↓
Write audit event
 ↓
COMMIT
```

If any step fails, the whole operation rolls back.

Concurrent approval attempts must be handled safely.

---

# 13. Evidence

Evidence bytes are stored in Cloudflare R2.

PostgreSQL stores only metadata/object keys.

```text
PostgreSQL
    = evidence_key

R2
    = actual file bytes
```

Example:

```text
transactions/{transactionId}/evidence.webp
```

Evidence is private and access-controlled.

---

# 14. Security Principles

Ledger treats financial data as sensitive.

Never:

```text
trust client authorization
trust client roles
trust client ownership
expose secrets
use floating point for authoritative money
silently rewrite approved financial history
store evidence binaries in PostgreSQL
bypass validation
bypass authorization
bypass required audit behavior
run destructive production migrations casually
```

Production rate limiting must be distributed.

Large data must be paginated/bounded.

Critical routes must avoid N+1 database patterns.

---

# 15. Development Environments

```text
Development
    ↓
Neon development branch/environment

Preview
    ↓
Isolated preview configuration

Production
    ↓
Neon production environment
```

Local development must not casually use the production database.

Drizzle is responsible for application database migrations.

For the Drizzle-backed Better Auth architecture, do not use direct Better Auth migration commands as the application migration strategy.

---

# 16. Environment Variables

Typical server environment (see `.env.example`):

```env
DATABASE_URL=
DATABASE_URL_POOLED=
DATABASE_URL_UNPOOLED=

# Neon branch the URLs above point at — drives the migration safety gate
NEON_BRANCH=

BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

The application reads environment variables only through the validated
server module (`src/server/env.ts`); missing or malformed values fail fast.

Never commit real values.

Never expose server secrets through `NEXT_PUBLIC_*`.

---

# 17. Development

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Local URL:

```text
http://localhost:3000
```

Validate the project with the scripts that actually exist in `package.json`.

Typical quality commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If a script is not present, do not assume it exists.

`npm test` runs the test files explicitly (Node's test runner executes
them concurrently):

```bash
tests/validations.test.ts      # env + login-schema unit tests
tests/auth-integration.test.ts # Better Auth semantics against the dev database
tests/routes.test.ts           # real `next start` server: routes, redirects,
                               # cookies, sign-in/sign-out over HTTP
```

The route tests spawn `next start`, so run `npm run build` before
`npm test`. Each suite owns a distinct fixture user so concurrent
suites cannot delete each other's rows.

---

# 18. Database Development

Typical migration workflow:

```text
Schema change
    ↓
npm run db:generate
    ↓
Review migration
    ↓
Development database
    ↓
Test
    ↓
Production promotion
```

Database commands:

```bash
npm run db:generate   # create migration files (offline, no database needed)
npm run db:migrate    # apply pending migrations (blocked on production)
npm run db:push       # sync schema without migration files (blocked on production)
npm run db:studio     # open Drizzle Studio (blocked on production)
npm run db:check      # read-only connectivity probe (select 1)
npm run db:seed-user  # provision one dev user (blocked on production)
```

There is no public account creation path. To provision a user on a
development branch:

```bash
npm run db:seed-user -- --email you@example.com --password 'correct horse' --name 'You'
```

The seeder writes the rows Better Auth's own sign-up flow would create
(`user` + credential `account`, hashed with the same `hashPassword`
Better Auth verifies against). Re-running with the same email refreshes
the name and password — the dev-only stand-in for the absent
password-reset flow. It refuses while `NEON_BRANCH=production`.

The migration safety gate in `drizzle.config.ts` refuses every
database-touching drizzle-kit command while `NEON_BRANCH=production`.
To develop against a branch:

```bash
neon checkout <branch>
# then update .env: NEON_BRANCH, DATABASE_URL, DATABASE_URL_POOLED,
# DATABASE_URL_UNPOOLED, and run `npm run db:check`
```

A reviewed production migration requires
`ALLOW_PRODUCTION_MIGRATIONS=true` for that single run.

Do not run local experimentation against production.

---

# 19. Phase Roadmap

Ledger is developed sequentially.

```text
PHASE 0  → Foundation
PHASE 1  → Authentication
PHASE 2  → Tenancy + Authorization
PHASE 3  → Projects
PHASE 4  → Transaction Ledger
PHASE 5  → Payments
PHASE 6  → Withdrawals
PHASE 7  → Approval Engine
PHASE 8  → Finance Engine
PHASE 9  → Evidence / R2
PHASE 10 → Auditability
PHASE 11 → Product UI
PHASE 12 → Security + Rate Limiting
PHASE 13 → Scalability + Performance
PHASE 14 → SEO + Public Web
PHASE 15 → Search Console + GEO
PHASE 16 → Testing + Release Quality
PHASE 17 → Observability
PHASE 18 → Production Infrastructure
PHASE 19 → Go-Live
```

Each phase has:

```text
one primary mission
explicit scope
explicit non-goals
exit criteria
```

Agents must not automatically jump to a later phase.

---

# 20. Documentation

| File | Purpose |
|---|---|
| `AGENTS.md` | Coding-agent and repository rules |
| `CLAUDE.md` | Claude-specific execution guidance |
| `PRD.md` | Product requirements |
| `ARCHITECTURE.md` | Technical architecture |
| `DESIGN_SYSTEM.md` | Product UI/UX system |
| `SECURITY.md` | Security requirements |
| `CODE_STYLE.md` | Coding conventions |
| `TESTING.md` | Testing strategy |
| `PRODUCT-MAP.md` | Product pages and interaction map |
| `00-MASTER-ROADMAP.md` | Complete phase roadmap |
| `PHASE-GLOBAL-RULES.md` | Rules shared by every phase |
| `01-PHASE-0-FOUNDATION.md` | Phase 0 execution contract |
| `02-PHASE-1-AUTHENTICATION.md` | Phase 1 execution contract |
| `...` | Remaining phase execution contracts |

---

# 21. Quality Gate

Before considering a change complete:

```text
TypeScript passes
Lint passes
Relevant tests pass
Build passes
Database migrations are reproducible
Authorization is server-side
Queries are correctly scoped
Financial calculations are deterministic
Concurrency is considered
Required audit behavior is correct
No secrets are committed
No accidental production database mutation occurred
Documentation matches implementation
```

---

# 22. Current Status

```text
Architecture
    ✅ Defined

Login UI/UX
    ✅ Complete

Phase 0 — Foundation
    ✅ Complete

Phase 1 — Authentication
    ✅ Complete

Finance
    ⏳ Not started

Production
    ⏳ Not started
```

The current implementation target is:

```text
PHASE 2
Tenancy + Authorization
```

The first complete vertical product slice remains:

```text
Auth
  ↓
Project
  ↓
Submit Payment
  ↓
Pending
  ↓
Approve
  ↓
Updated Ledger
  ↓
Updated Balance
```
