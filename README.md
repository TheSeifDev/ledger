# LEDGER

```text
┌──────────────────────────────────────────────┐
│               PHANTOMS FINANCE               │
├──────────────────────────────────────────────┤
│                                              │
│   L E D G E R                                │
│   Internal Team Finance Platform             │
│                                              │
│   Projects · Budgets · Members               │
│   Transactions · Approvals · Audit           │
│                                              │
└──────────────────────────────────────────────┘
```

Ledger is the internal finance and project ledger for PHANTOMS.

It centralizes project budgets, member contributions, withdrawals, approvals, evidence, balances, and financial audit history.

## 1. Positioning

```text
PHANTOMS Finance
        ↓
Team Finance Platform
        ↓
Multi-Organization SaaS   ← future, not now
```

The database is **multi-tenant from day one**.

The product is **not** a SaaS yet. One organization. One team. No billing, no org switching, no subscription logic. The schema simply never needs a painful migration when that day comes.

## 2. Final Architecture Decision

```text
┌──────────────────────────────────────────────┐
│               PHANTOMS FINANCE               │
├──────────────────────────────────────────────┤
│                                              │
│  Next.js + TypeScript                        │
│       │                                      │
│       ├── Server Components                  │
│       ├── Server Actions                     │
│       └── Route Handlers                     │
│                    │                         │
│                    ▼                         │
│              Finance Domain                  │
│                    │                         │
│                    ▼                         │
│                Drizzle ORM                   │
│                    │                         │
│                    ▼                         │
│              Neon PostgreSQL                 │
│                                              │
│  Better Auth ───────────── Authentication    │
│                                              │
│  Cloudflare R2 ─────────── Evidence Files    │
│                                              │
│  Vercel ──────────────────── Deployment      │
│                                              │
└──────────────────────────────────────────────┘
```

## 3. Core Philosophy

```text
PostgreSQL = Financial Truth

R2 = Files

Next.js = Application

Finance Domain = Business Rules

Audit Log = Accountability

Roles/Permissions = Security

UI = Presentation
```

## 4. Build Phases

Every phase is fully working before the next one starts:

```text
Foundation
    ↓
Database
    ↓
Auth
    ↓
Projects
    ↓
Transactions
    ↓
Approval
    ↓
Finance Engine
    ↓
Audit
    ↓
Dashboard
```

## 5. Stack

| Layer      | Technology                        |
| ---------- | --------------------------------- |
| Framework  | Next.js (App Router) + TypeScript |
| UI         | React, Tailwind CSS, shadcn/ui, Lucide |
| Database   | Neon PostgreSQL + Drizzle ORM     |
| Auth       | Better Auth                       |
| Files      | Cloudflare R2                     |
| Validation | Zod                               |
| Deployment | Vercel                            |

## 6. Product Flow

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
   │
   └── REJECTED
          ↓
       History
```

## 7. Core Roles

| Role   | Access                                            |
| ------ | ------------------------------------------------- |
| OWNER  | Full control                                      |
| HEAD   | Review and approve/reject                         |
| MEMBER | View authorized projects, submit transactions     |

```text
A user cannot approve their own transaction.
```

## 8. Financial Model

Project:

```text
Approved Payments
= SUM(PAYMENT where APPROVED)

Approved Withdrawals
= SUM(WITHDRAWAL where APPROVED)

Net Collected
= Approved Payments - Approved Withdrawals

Remaining Budget
= Total Budget - Net Collected
```

Member:

```text
Net Contribution
= Payments - Withdrawals

Balance
= Net Contribution - Target Contribution
```

## 9. Development

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Expected local URL:

```text
http://localhost:3000
```

Validation commands:

```bash
npm run lint
npm run typecheck
npm run build
```

Migration commands (Drizzle Kit):

```bash
npm run db:generate   # generate SQL migration files from db/schema (offline)
npm run db:migrate    # apply pending migrations from ./drizzle
```

## 10. Database

```text
Local Development
        ↓
Neon development branch

Production
        ↓
Neon production branch
```

Drizzle is responsible for application/database migrations.

Do not use direct Better Auth migration commands for the Drizzle-backed setup.

Migration safety: `db:migrate` (and every other database-touching
drizzle-kit command) refuses to run while `NEON_BRANCH=production` —
develop on a Neon development branch (for example via `neon checkout`)
and keep `.env` pointed at it. The `ALLOW_PRODUCTION_MIGRATIONS`
override exists for reviewed, intentional production migrations only.

## 11. Environment Variables

Copy `.env.example` to `.env` and fill in real values. The environment is
validated at load time — missing or invalid variables fail with an
explicit message naming them (see `lib/env.ts`).

```env
DATABASE_URL=             # generic Neon value (optional)
DATABASE_URL_POOLED=      # app runtime (db/index.ts, lib/auth.ts)
DATABASE_URL_UNPOOLED=    # drizzle-kit migrations (drizzle.config.ts)
NEON_BRANCH=development   # migration gate refuses "production"
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

# R2 (later phases)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

Never commit real values.

## 12. Project Structure

`app/`, `src/`, and `lib/` are siblings at the project root:

```text
project-root/
├── app/            # route orchestration (App Router)
├── src/
│   └── components/ # reusable UI
├── lib/            # domain/server utilities (env, auth, validation)
├── db/             # Drizzle client, schema, migration guards
│   └── schema/
├── drizzle/        # generated SQL migrations
├── tests/          # unit/integration tests
├── e2e/            # end-to-end tests
└── drizzle.config.ts
```

## 13. Documentation

| File               | Purpose                           |
| ------------------ | --------------------------------- |
| `AGENTS.md`        | Coding-agent/project instructions |
| `CLAUDE.md`        | Claude-specific execution guidance |
| `PRD.md`           | Product requirements              |
| `ARCHITECTURE.md`  | Technical architecture            |
| `DESIGN_SYSTEM.md` | UI/UX rules                       |
| `SECURITY.md`      | Security requirements             |
| `CODE_STYLE.md`    | Coding conventions                |
| `TESTING.md`       | Testing strategy                  |

## 14. Quality Gate

Before considering a feature complete:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run only the commands that exist in `package.json`.

## 15. Security

Financial data is sensitive.

```text
Never
├── trust client authorization
├── expose secrets
├── use floating point for money
├── silently rewrite approved history
├── store evidence binaries in PostgreSQL
├── bypass audit logging
└── run destructive production migrations casually
```

## 16. Status

Early development / foundation phase.

The first target is the complete vertical slice:

```text
Auth
→ Project
→ Submit Payment
→ Pending
→ Approve
→ Updated Ledger
→ Updated Balance
```
