# Architecture

## 1. System

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

## 2. Architectural Principles

### Server Is the Source of Truth

The client displays financial state but never owns authoritative financial state.

### Domain-First

Financial rules live in domain modules rather than UI components.

### Explicit Authorization

Authentication answers "who are you?"

Authorization answers "what can you do?"

Both are required.

### Auditability

Important financial state transitions are recorded.

### Exact Money

Use integer minor units:

```text
750.00 EGP → 75000
```

Do not use JavaScript floating-point arithmetic.

## 3. Layers

### UI

`src/app`, `src/components`

Responsible for:
- rendering
- interaction
- loading/error states
- accessibility

Not responsible for:
- financial truth
- permission decisions
- database writes

### Actions / API

`src/actions`, `src/app/api`

Responsible for:
- receiving requests
- authentication
- input validation
- calling domain services

### Domain

`src/lib/finance`, `src/lib/permissions`

Responsible for:
- business rules
- calculations
- authorization decisions
- transaction workflows

### Persistence

`src/db`

Responsible for:
- schema
- migrations
- queries
- database transactions

### Storage

`src/lib/storage`

Responsible for:
- R2 object upload
- signed access URLs
- object deletion where allowed

## 4. Database Model

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

## 5. Transaction Model

Use one unified ledger:

```text
transaction.type:
  PAYMENT
  WITHDRAWAL

transaction.status:
  PENDING
  APPROVED
  REJECTED
```

This avoids separate financial systems for payments and withdrawals.

## 6. Financial Calculations

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

## 7. Atomic Approval

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

## 8. Storage

PostgreSQL stores:

```text
evidence_key =
transactions/{transactionId}/evidence.webp
```

The image itself is stored in Cloudflare R2.

Do not store binary evidence in PostgreSQL.

## 9. Routes

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

## 10. Deployment

Development:

```text
Local Next.js
→ Neon development branch
→ R2 development bucket/path
```

Production:

```text
Vercel
→ Neon production branch
→ R2 production bucket/path
```

Do not use the production database for normal local migration experimentation.
