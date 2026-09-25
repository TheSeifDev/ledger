# AGENTS

```text
┌──────────────────────────────────────────────────────────────┐
│                        PHANTOMS LEDGER                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  AGENTS                                                      │
│  Coding-Agent Instructions                                   │
│                                                              │
│  Stack · Architecture · Rules · Domains · Finance · Security │
│  Workflow · Testing · Scalability · Done                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Project

Ledger is the internal PHANTOMS finance platform.

It manages:

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

Ledger is an internal application. It is not a public banking platform, payment processor, payroll system, or public accounting product.

---

# 1. Core Stack

```text
Next.js App Router + TypeScript
        ↓
React Server Components
        ↓
Server Actions / Route Handlers
        ↓
Domain + Server Services
        ↓
Drizzle ORM + Drizzle Kit
        ↓
Neon PostgreSQL

Authentication:
Better Auth

Evidence:
Cloudflare R2

Validation:
Zod

UI:
Tailwind CSS + shadcn/ui + Lucide + Alexandria

Deployment:
Vercel

Source Control:
GitHub
```

Server Components are the default.

Client Components are used only when browser interactivity or browser-only APIs require them.

---

# 2. Repository Structure

## IMPORTANT

The repository intentionally uses **root-level `app/`, `components/`, and `lib/`**.

Do NOT move them into `src/`.

The required structure is:

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

## Structure Rules

```text
app/        → routing, layouts, pages, route handlers
components/ → reusable UI
lib/        → shared/domain/application modules
src/actions/→ thin application mutation entry points
src/db/     → database connection, schema, migrations
src/server/ → server-only services, repositories, guards
src/types/  → shared cross-layer types
public/     → static public assets
```

### DO NOT create this architecture

```text
src/
├── app/
├── components/
└── lib/
```

### DO NOT move

```text
app/
components/
lib/
```

into `src/`.

This is a project-level architectural decision.

---

# 3. Working Directory / Worktree Policy

Normal development happens directly in the current primary repository checkout.

Do NOT create, switch to, or use Git worktrees unless the user explicitly requests one.

Do NOT isolate normal phase implementation under:

```text
.claude/worktrees/
```

The active repository root is the source of truth.

All implementation, validation, and documentation changes for normal phase execution must happen in the current checkout.

# 3. Dependency Direction

The dependency direction is:

```text
UI
│
▼
Actions / Route Handlers
│
▼
Server Services / Domain
│
▼
Repositories
│
▼
Drizzle ORM
│
▼
Neon PostgreSQL
```

Supporting infrastructure:

```text
Better Auth → authentication/session
Cloudflare R2 → evidence storage
Rate-limit provider → distributed abuse protection
Observability → logs/metrics/errors
```

## Forbidden

```text
UI → Drizzle directly
UI → PostgreSQL directly
UI → server secrets
Client → authorization decisions
Client → financial truth
Components → raw SQL
Components → database transactions
```

UI is presentation.

Server/domain layers own application behavior.

---

# 4. Domain Boundaries

Business domains belong in root-level `lib/`.

```text
lib/
├── auth/
├── finance/
├── permissions/
├── storage/
├── validation/
├── rate-limit/
├── seo/
├── observability/
└── utils/
```

The finance domain MUST NOT live under `src/lib/`.

## Finance

```text
lib/finance/
├── calculations.ts
├── transactions.ts
├── projects.ts
├── members.ts
├── approvals.ts
└── types.ts
```

Financial rules belong here, not inside React components or page files.

---

# 5. Server Application Boundaries

Server-only orchestration belongs under:

```text
src/server/
├── services/
├── repositories/
└── guards/
```

## Services

Services orchestrate business operations.

Examples:

```text
transaction service
approval service
project service
member service
```

## Repositories

Repositories encapsulate data access through Drizzle.

The UI and components do not call repositories directly.

## Guards

Guards enforce server-side prerequisites such as:

```text
authenticated user
organization membership
project access
role/permission
```

---

# 6. Actions and Route Handlers

Actions live under:

```text
src/actions/
```

Actions MUST be thin.

Expected flow:

```text
Action
  ↓
Authenticate
  ↓
Validate
  ↓
Authorize
  ↓
Call Service
  ↓
Return Safe Result
```

Do not put large business workflows directly inside Server Actions.

Route Handlers are used for:

```text
Better Auth
webhooks
external integrations
signed upload flows
special machine-facing endpoints
```

Do not create duplicate APIs for the same operation without a concrete architectural reason.

---

# 7. Non-Negotiable Rules

```text
1. Financial truth lives on the server/database.
   Never calculate authoritative balances from client state.

2. PostgreSQL is the authoritative financial source of truth.

3. Never trust client-supplied:
   user_id
   organization_id
   project_id
   role
   ownership
   approval state
   permission

4. Every protected mutation must:
   authenticate
   validate
   authorize
   apply domain rules
   persist safely

5. Authentication != authorization.

6. Authorization is always server-side.

7. There is NO public signup.

8. There is NO automatic account creation during login.

9. A transaction creator cannot approve or reject their own transaction.

10. Financial amounts must be exact.
    Prefer integer minor units:
    amount_minor_units.

11. Never use JavaScript floating-point arithmetic
    for authoritative financial calculations.

12. Approval and its required audit event must be atomic.

13. Never hard-delete approved financial transactions.
    Preserve ledger history.

14. Evidence bytes belong in Cloudflare R2.
    PostgreSQL stores metadata/object keys only.

15. Never expose:
    database credentials
    Better Auth secrets
    R2 credentials
    API secrets
    private server environment variables

16. Do not use `npm audit fix --force`
    without reviewing compatibility and dependency changes.

17. Do not bypass validation, authorization,
    concurrency protection, or audit behavior
    just to make a feature work.

18. Server Components are the default.

19. Client Components exist only where required.

20. Do not introduce a new dependency when an
    existing project dependency or platform capability is sufficient.

21. Every financial query must be organization-scoped.

22. Project access must be organization-scoped
    and project-membership-aware.

23. Production rate limiting must be distributed.

24. Large datasets must be paginated or otherwise bounded.

25. No N+1 queries on critical routes.

26. Production and development infrastructure
    must be isolated.

27. Public SEO must never expose private finance data.

28. Critical financial and security regressions must
    receive regression coverage.

29. Better Auth schema participates in the Drizzle
    migration strategy.

30. Local development must not casually use
    the production database.
```

---

# 8. Authentication Rules

Ledger uses pre-provisioned accounts.

```text
Existing user
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
/sign-up
/register
automatic account creation
```

Better Auth owns:

```text
password hashing
password verification
sessions
session cookies
authentication state
```

Do not implement custom password hashing or custom auth tokens.

---

# 9. Financial Rules

For APPROVED transactions only:

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

```text
PENDING
    → no approved financial impact

REJECTED
    → no approved financial impact

APPROVED
    → enters financial truth
```

Financial aggregation should happen in the database/domain layer, not in React.

---

# 10. Transaction Model

```text
TYPE
├── PAYMENT
└── WITHDRAWAL
```

```text
STATUS
├── PENDING
├── APPROVED
└── REJECTED
```

A transaction belongs to exactly one:

```text
organization
project
submitting user
```

A transaction may contain:

```text
amount_minor_units
paid_to
notes
evidence_key
status
approved_by
approved_at
timestamps
```

Notes are limited to 255 characters.

---

# 11. Roles

```text
OWNER
│
└── Full organization/project/finance control

HEAD
│
└── Review and approve/reject eligible transactions
    Cannot approve their own transaction

MEMBER
│
└── View authorized projects
    Submit permitted transactions
    Cannot approve transactions
```

UI role checks are for UX only.

Server authorization is authoritative.

---

# 12. Multi-Tenancy

Ledger is currently used as a single-organization product:

```text
PHANTOMS
```

The database is multi-tenant from day one.

Core ownership:

```text
organizations
    │
    ├── organization_members
    │
    └── projects
          ├── project_members
          └── transactions
```

Tenant-owned data must always have a reliable organization scope.

At minimum:

```text
projects
project_members
transactions
audit_logs
```

must be organization-resolvable.

No organization scope:

```text
→ no data access
```

---

# 13. Database

Core application tables:

```text
users
organizations
organization_members
projects
project_members
transactions
audit_logs
```

Better Auth tables are managed through the same Drizzle migration strategy.

Database access belongs under:

```text
src/db/
├── index.ts
├── schema/
└── migrations/
```

---

# 14. Database Rules

Use:

```text
foreign keys
not-null constraints
check constraints
unique constraints
indexes
database transactions
```

Use indexes based on real query patterns.

Critical financial queries should be bounded and scoped.

Never use:

```text
SELECT *
```

blindly on large datasets.

Avoid:

```text
fetch all rows
→ calculate in JavaScript
```

Prefer:

```text
SQL aggregate/query
→ domain service
→ UI
```

---

# 15. Approval Workflow

Approval must be atomic:

```text
BEGIN
    ↓
verify transaction exists
    ↓
verify transaction is PENDING
    ↓
verify actor authorization
    ↓
verify actor != transaction owner
    ↓
update transaction
    ↓
create audit record
    ↓
COMMIT
```

Concurrent approval attempts must be handled safely.

Examples:

```text
PENDING → APPROVED
PENDING → REJECTED

APPROVED → APPROVE again
    ❌

REJECTED → APPROVE normally
    ❌
```

---

# 16. Idempotency

Financial mutations must consider:

```text
double-click
browser retry
network retry
request replay
refresh after submission
```

Where required, use an idempotency key or database-backed uniqueness strategy.

Never create duplicate financial records because the client retried a request.

---

# 17. Evidence Storage

PostgreSQL stores:

```text
evidence_key
```

R2 stores:

```text
actual file bytes
```

Example:

```text
transactions/{transactionId}/evidence.webp
```

Object keys are generated by the server.

User filenames must never be treated as trusted storage paths.

Private evidence requires authorized/signed access.

---

# 18. Rate Limiting

Rate limit high-risk operations:

```text
authentication
password actions
upload authorization
webhooks
public APIs
expensive reports/exports
```

Production rate limiting must be distributed.

Do not rely on one Vercel instance's memory.

The abstraction belongs in:

```text
lib/rate-limit/
```

Application code should depend on a project abstraction rather than a provider-specific implementation.

---

# 19. Scalability

Critical data must be:

```text
paginated
bounded
indexed
efficiently aggregated
```

Avoid:

```text
N+1 queries
unbounded lists
fetch-all dashboards
client-side financial aggregation
```

Use database aggregation for:

```text
project totals
member totals
pending counts
approved totals
```

Use cursor pagination where appropriate for large/rapidly changing datasets.

---

# 20. Frontend Rules

PHANTOMS Product UI:

```text
Font:
Alexandria

Palette:
Black
White / Off-white
PHANTOMS Red
```

Product UI should preserve PHANTOMS visual identity without copying social-media layouts literally.

## Every data-driven screen must handle

```text
Loading
Success
Empty
Error
Unauthorized
```

## Every mutation must handle

```text
Idle
Submitting
Success
Validation Error
Authorization Error
Conflict
Server Error
```

No critical state may be communicated by color alone.

---

# 21. SEO / Public Web

SEO applies to public content.

The private finance application remains private.

Public surfaces may use:

```text
metadata
canonical URLs
Open Graph
robots.ts
sitemap.ts
structured data where applicable
semantic HTML
internal linking
```

Never expose as public SEO content:

```text
project budgets
transactions
member balances
audit logs
evidence
private finance routes
```

Robots.txt is not access control.

Authentication is the security boundary.

---

# 22. Google Search Console / GEO

For public pages:

```text
Google Search Console
├── property verification
├── sitemap submission
├── URL inspection
├── indexing monitoring
├── query performance
├── clicks
├── impressions
└── CTR
```

GEO means making public information understandable to search and AI systems through:

```text
clear page purpose
semantic headings
explicit entities
useful original content
stable canonical URLs
accurate structured data
descriptive internal links
```

Do not use:

```text
keyword stuffing
fake entities
fake citations
machine-only hidden content
thin duplicate pages
```

---

# 23. Observability

Production observability should cover:

```text
server failures
authentication failures
transaction failures
approval failures
upload failures
rate-limit events
slow requests
database failures
deployment failures
```

Never log:

```text
passwords
tokens
database URLs
private keys
R2 secrets
unnecessary sensitive data
```

Important financial actions must be traceable:

```text
Actor
 ↓
Action
 ↓
Entity
 ↓
Result
 ↓
Audit
```

---

# 24. Development Workflow

Before changing code:

```text
1. Read relevant architecture/phase docs.
2. Inspect existing implementation.
3. Confirm the current phase.
4. Confirm scope and non-goals.
5. Implement the smallest complete change.
```

During implementation:

```text
6. Validate untrusted input with Zod.
7. Authenticate.
8. Authorize server-side.
9. Apply domain rules.
10. Use the correct database transaction boundary.
11. Add relevant regression coverage.
```

After implementation:

```text
12. Run available validation.
13. Review security implications.
14. Review database/migration impact.
15. Review query performance.
16. Update documentation when behavior or architecture changes.
17. Report created/modified files.
18. Report validation results.
```

Never silently jump to a later phase.

---

# 25. Phase Discipline

The project is executed sequentially.

```text
Phase 0  Foundation
Phase 1  Authentication
Phase 2  Tenancy + Authorization
Phase 3  Projects
Phase 4  Transaction Ledger
Phase 5  Payments
Phase 6  Withdrawals
Phase 7  Approvals
Phase 8  Finance Engine
Phase 9  Evidence / R2
Phase 10 Auditability
Phase 11 Product UI
Phase 12 Security + Rate Limiting
Phase 13 Scalability + Performance
Phase 14 SEO + Public Web
Phase 15 GSC + GEO
Phase 16 Testing + Release Quality
Phase 17 Observability
Phase 18 Production Infrastructure
Phase 19 Go-Live
```

If the agent is executing Phase N:

```text
Implement Phase N.
Do not automatically implement Phase N+1.
```

Discovered later-phase problems must be documented and deferred unless they block the current phase.

---

# 26. Testing Policy

Testing priority follows risk.

## Unit

```text
finance calculations
validation
permission helpers
pure business rules
```

## Integration

```text
database workflows
authentication
authorization
transactions
approval
audit
storage authorization
```

## E2E

Critical path:

```text
Login
 ↓
Dashboard
 ↓
Project
 ↓
Submit Payment
 ↓
Pending
 ↓
Approve
 ↓
Updated Totals
 ↓
Updated Member Balance
 ↓
Audit
```

Every discovered financial/security regression receives a regression test.

Do not create large amounts of business-domain tests before the relevant domain exists.

---

# 27. Definition of Done

A change is not complete until:

```text
├── TypeScript passes
├── Lint passes
├── Relevant tests pass
├── Build passes
├── Database migrations are reproducible
├── Authorization is enforced server-side
├── Queries are correctly organization-scoped
├── Financial calculations are deterministic
├── Concurrency rules are respected
├── Audit behavior is correct where required
├── Secrets are not committed
├── No production DB was casually modified
├── Performance implications were reviewed
└── Documentation is updated when necessary
```

---

# 28. Agent Behavior

When a phase file is supplied:

```text
READ
 ↓
INSPECT
 ↓
PLAN WITHIN PHASE
 ↓
IMPLEMENT
 ↓
VALIDATE
 ↓
REPORT
 ↓
STOP
```

Do not:

```text
skip phases
merge unrelated phases
redesign completed UI without need
change repository architecture
introduce unnecessary libraries
modify production infrastructure casually
```

The agent must preserve the architecture and phase boundaries defined by the project documentation.


## 44. Phase Execution Discipline

When the user supplies a phase file, execute only that phase.

```text
Read
 ↓
Inspect
 ↓
Implement current phase
 ↓
Validate
 ↓
Report
 ↓
STOP
```

Do not automatically implement Phase N+1.

Do not create a worktree unless the user explicitly requests a worktree.

If later-phase gaps are discovered, document them and defer them.

