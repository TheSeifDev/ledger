# ARCHITECTURE

```text
┌──────────────────────────────────────────────┐
│               PHANTOMS FINANCE               │
├──────────────────────────────────────────────┤
│                                              │
│   ARCHITECTURE                               │
│   Technical Foundation                       │
│                                              │
│   System · Layers · Multi-Tenancy            │
│   Data Model · Finance Engine · Storage      │
│                                              │
└──────────────────────────────────────────────┘
```

## 1. Final Architecture Decision

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

### Core Philosophy

```text
PostgreSQL = Financial Truth

R2 = Files

Next.js = Application

Finance Domain = Business Rules

Audit Log = Accountability

Roles/Permissions = Security

UI = Presentation
```

### Build Order

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

Each phase is fully working before moving to the next.

## 2. System

Ledger is a Next.js full-stack application backed by Neon PostgreSQL.

```text
Browser
  │
  ▼
Next.js App Router
  │
  ├── Server Components
  ├── Server Actions
  └── Route Handlers
        │
        ▼
Application / Domain Services
        │
        ├── Auth
        ├── Permissions
        ├── Finance
        └── Storage
              │
              ▼
        Drizzle ORM
              │
              ▼
        Neon PostgreSQL

Evidence:
Application → Cloudflare R2
```

## 3. Architectural Principles

### Server Is the Source of Truth

```text
Client  → displays financial state
Server  → owns financial state
```

The client never owns authoritative financial state.

### Domain-First

Financial rules live in domain modules, not in UI components.

### Explicit Authorization

```text
Authentication   → "who are you?"

Authorization    → "what can you do?"

Both are required. Always.
```

### Auditability

Important financial state transitions are recorded.

### Exact Money

Use integer minor units:

```text
750.00 EGP → 75000
```

Do not use JavaScript floating-point arithmetic.

## 4. Layers

```text
┌──────────────────────────────────────────────┐
│  UI                                          │
│  app · src/components                        │
│  rendering · interaction · a11y              │
├──────────────────────────────────────────────┤
│  Actions / API                               │
│  app/api                                     │
│  auth · validation · domain calls            │
├──────────────────────────────────────────────┤
│  Domain                                      │
│  lib/finance · lib/permissions               │
│  business rules · calculations · workflows   │
├──────────────────────────────────────────────┤
│  Persistence                                 │
│  db                                          │
│  schema · migrations · queries · tx          │
├──────────────────────────────────────────────┤
│  Storage                                     │
│  lib/storage                                 │
│  R2 upload · signed URLs · deletion          │
└──────────────────────────────────────────────┘
```

### UI

Responsible for:

```text
├── rendering
├── interaction
├── loading/error states
└── accessibility
```

Not responsible for:

```text
├── financial truth
├── permission decisions
└── database writes
```

### Actions / API

Responsible for:

```text
├── receiving requests
├── authentication
├── input validation
└── calling domain services
```

### Domain

Responsible for:

```text
├── business rules
├── calculations
├── authorization decisions
└── transaction workflows
```

### Persistence

Responsible for:

```text
├── schema
├── migrations
├── queries
└── database transactions
```

### Storage

Responsible for:

```text
├── R2 object upload
├── signed access URLs
└── object deletion where allowed
```

## 5. Multi-Tenancy — Day One

The product is a single-organization platform today, but the database is multi-tenant from day one.

```text
┌──────────────────────────────────────────────┐
│  DECISION                                    │
├──────────────────────────────────────────────┤
│                                              │
│  Multi-tenant schema   → YES (day one)       │
│  Multi-tenant product  → NO (not now)        │
│                                              │
│  organizations exists from the first         │
│  migration. Every financial row carries      │
│  organization_id.                            │
│                                              │
└──────────────────────────────────────────────┘
```

### Tenant Root

```text
organizations
      │
      ├── organization_members
      │         │
      │         ▼
      │      users
      │
      └── projects
                │
                ├── project_members
                │         │
                │         ▼
                │      users
                │
                └── transactions
                          │
                          ▼
                      audit_logs
```

### Tenant Isolation Rule

Every financial row answers one question first:

```text
"Which organization does this belong to?"
```

```text
organization_id is mandatory on:

├── projects
├── project_members
├── transactions
└── audit_logs

No organization scope ⇒ No data access
```

### Why Not Full SaaS Now

```text
SaaS Complexity
├── org switching UI            → skipped
├── invitations per org         → skipped
├── billing / subscriptions     → skipped
├── custom domains              → skipped
└── usage metering              → skipped

Schema Complexity
├── organizations table         → built
├── organization_id scoping     → built
├── membership model            → built
└── per-tenant queries          → built
```

The isolation is structural. The SaaS surface can come later without schema surgery.

## 6. Database Model

Core tables:

```text
users
organizations
organization_members
projects
project_members
transactions
audit_logs
```

Relationships:

```text
Organization
 ├── Members
 └── Projects
       ├── Members
       └── Transactions
                    └── Audit Logs
```

Keep Better Auth tables aligned with the project's Drizzle schema/migrations.

## 7. Transaction Model

One unified ledger:

```text
transaction.type
├── PAYMENT
└── WITHDRAWAL

transaction.status
├── PENDING
├── APPROVED
└── REJECTED
```

This avoids separate financial systems for payments and withdrawals.

A transaction belongs to exactly one project, and every project belongs to exactly one organization.

## 8. Financial Calculations

```text
Approved Payments
= SUM(PAYMENT where status = APPROVED)

Approved Withdrawals
= SUM(WITHDRAWAL where status = APPROVED)

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

## 9. Atomic Approval

Approval must execute inside one database transaction:

```text
BEGIN
→ verify transaction is PENDING
→ verify actor permission
→ verify actor != transaction.user_id
→ update transaction
→ insert audit_log
→ COMMIT
```

If any operation fails, the complete operation rolls back.

## 10. Storage

PostgreSQL stores metadata only:

```text
evidence_key =
transactions/{transactionId}/evidence.webp
```

The image itself is stored in Cloudflare R2.

```text
PostgreSQL = keys
R2         = bytes
```

Do not store binary evidence in PostgreSQL.

## 11. Routes

```text
/
/login
/dashboard
/projects
/projects/[slug]
/projects/[slug]/transactions
/projects/[slug]/members
/projects/[slug]/settings
/pending
/settings
```

## 12. Deployment

```text
Development
├── Local Next.js
├── Neon development branch
└── R2 development bucket/path

Production
├── Vercel
├── Neon production branch
└── R2 production bucket/path
```

Do not use the production database for normal local migration experimentation.
