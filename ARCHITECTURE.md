# ARCHITECTURE

## PHANTOMS Ledger — Technical Architecture

**Current state:** Login screen UI/UX is complete. Authentication, database, finance workflows, and production infrastructure are not considered complete until their phases are implemented and verified.

---

## 1. Final Architecture Decision

Ledger is a full-stack Next.js application.

```text
Browser
  |
  v
Next.js App Router
  |
  +-- Server Components
  +-- Client Components
  +-- Server Actions
  +-- Route Handlers
  |
  v
Application / Domain Layer
  |
  +-- Authentication
  +-- Authorization
  +-- Finance Services
  +-- Validation
  +-- Storage Services
  +-- Rate Limiting
  |
  v
Persistence Layer
  |
  +-- Drizzle ORM
  |
  v
Neon PostgreSQL

Private evidence:
Application --> Cloudflare R2

Deployment:
GitHub --> Vercel
```

### Core philosophy

```text
PostgreSQL       = authoritative financial state
R2               = file bytes
Next.js          = application runtime
Domain           = business rules
Drizzle          = persistence + migrations
Better Auth      = authentication + sessions
Authorization    = server-side access control
Audit Log        = accountability
React            = presentation
```

The frontend never becomes the financial source of truth.

---

## 2. Product Boundary

Ledger is an internal PHANTOMS finance platform for:

- organizations
- projects
- project members
- budgets
- payments
- withdrawals
- approvals
- balances
- evidence
- audit history

It is not a banking, payment-processing, payroll, tax, or public accounting platform.

Public web/marketing pages are a separate surface from the private finance application.

---

## 3. Authentication Model

There is **no public registration**.

Accounts are provisioned before login.

```text
Pre-provisioned user
      |
      v
/login
      |
      v
Email + Password
      |
      v
Better Auth
      |
      v
Session
      |
      v
Protected application
```

Rules:

```text
Unknown account
  -> reject authentication
  -> do not create a user

Existing account
  -> verify credentials
  -> create session
```

Better Auth owns password hashing, verification, sessions, and authentication cookies.

---

## 4. Repository Structure

The repository intentionally keeps `app`, `components`, and `lib` at the repository root.

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
│   ├── validation/
│   ├── storage/
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
└── tsconfig.json
```

### Directory Responsibilities

- `app/` → routing, layouts, pages, metadata, and route handlers
- `components/` → reusable UI and feature components
- `lib/` → domain/application modules such as finance, auth, permissions, validation, storage, rate limiting, SEO, and observability
- `src/actions/` → thin application mutation entry points
- `src/db/` → database connection, schema, and migrations
- `src/server/` → server-only services, repositories, and guards
- `src/types/` → genuinely shared cross-layer types
- `public/` → static public assets

### Non-Negotiable Structure Rule

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

Do **not** create:

```text
src/app/
src/components/
src/lib/
```

unless the architecture is explicitly changed in a future reviewed decision.


---

## 4.1 Working Directory / Worktree Policy

Normal development happens directly in the current primary repository checkout.

```text
Current repository
    ↓
Claude Code
    ↓
same working tree
```

Do **not** create, switch to, or use Git worktrees for normal phase execution unless the user explicitly requests a worktree.

Do not move implementation into:

```text
.claude/worktrees/
```

The active repository checkout is the source of truth for normal development.

A phase must be implemented, validated, and reviewed in the current checkout.

## 5. Dependency Direction

```text
UI / App Router
      |
      v
Actions / Route Handlers
      |
      v
Server Services
      |
      v
Domain / Finance
      |
      v
Repositories / Drizzle
      |
      v
PostgreSQL
```

Forbidden patterns:

```text
UI --> Drizzle directly
UI --> financial SQL
UI --> server secrets
Client --> authorization decisions
```

---

## 6. Next.js Model

### Server Components by default

Use them for secure data fetching and read-heavy screens:

- dashboard
- projects
- project overview
- transaction lists
- member summaries

Client Components are reserved for browser interactivity such as forms, dialogs, local state, and browser APIs.

### Server Actions

Use for internal application mutations:

- createProject
- updateProject
- submitPayment
- submitWithdrawal
- approveTransaction
- rejectTransaction
- addProjectMember
- removeProjectMember

### Route Handlers

Use for:

- Better Auth
- webhooks
- external integration endpoints
- signed-upload workflows
- machine-facing APIs

Do not create duplicate APIs for the same operation without a concrete reason.

---

## 7. Request / Mutation Pipeline

Every protected mutation follows:

```text
Request
  |
  v
Authenticate
  |
  v
Validate input
  |
  v
Resolve organization
  |
  v
Resolve project/resource
  |
  v
Authorize action
  |
  v
Load current state
  |
  v
Apply domain rule
  |
  v
Persist mutation
  |
  v
Write audit event when required
  |
  v
Return safe result
```

No financial mutation may skip these controls.

---

## 8. Multi-Tenancy — Day One

Ledger is currently used by one PHANTOMS organization, but the database is tenant-aware from the first migration.

```text
organizations
   |
   +-- organization_members --> users
   |
   +-- projects
         |
         +-- project_members --> users
         |
         +-- transactions
               |
               +-- audit_logs
```

Every tenant-owned resource must be traceable to an organization. Tenant isolation is enforced server-side, not by UI filtering.

The product does not need SaaS features such as billing, organization switching, or public invitations yet.

---

## 9. Authorization

Authentication answers:

```text
Who are you?
```

Authorization answers:

```text
What can you do?
```

Roles:

```text
OWNER
HEAD
MEMBER
```

The server must never trust:

- client role
- client user id
- hidden fields
- localStorage
- React state
- URL alone

Authorization resolution:

```text
Current user
   |
Organization membership
   |
Project membership
   |
Role / permission
   |
Allowed action
```

---

## 10. Database Model

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

Better Auth tables are maintained inside the same Drizzle migration system.

Relationships:

```text
Organization
├── Members
└── Projects
    ├── Members
    └── Transactions
        └── Audit Logs
```

---

## 11. Transaction Model

One unified ledger:

```text
type
├── PAYMENT
└── WITHDRAWAL

status
├── PENDING
├── APPROVED
└── REJECTED
```

Every transaction belongs to exactly one project, one organization, and one submitting user.

---

## 12. Money Representation

Use exact integer minor units.

```text
750.00 EGP -> 75000
```

Never use JavaScript floating-point arithmetic for authoritative financial calculations.

---

## 13. Finance Engine

Business rules live in:

```text
src/lib/finance/
├── calculations.ts
├── transactions.ts
├── projects.ts
├── members.ts
├── approvals.ts
└── types.ts
```

Core calculations:

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

Pending and rejected records do not affect approved financial totals.

---

## 14. Approval Architecture

Approval is a state transition and must be atomic.

```text
PENDING
   |
   +-- APPROVE --> APPROVED
   |
   +-- REJECT  --> REJECTED
```

Approval transaction:

```text
BEGIN
  verify transaction exists
  verify status = PENDING
  verify actor permission
  verify actor != transaction owner
  update transaction
  insert audit_log
COMMIT
```

If any step fails, the entire operation rolls back.

Concurrency is handled by authoritative database state and state checks.

---

## 15. Idempotency

Financial mutations must defend against:

- double clicks
- browser retries
- network retries
- repeated requests

Where needed, use idempotency keys or database uniqueness constraints.

Approval is state-safe:

```text
APPROVED -> approve again = rejected
```

unless an explicit correction workflow is later introduced.

---

## 16. Evidence Storage

PostgreSQL stores metadata/object keys. Cloudflare R2 stores file bytes.

```text
PostgreSQL = metadata / object key
R2         = actual evidence file
```

Example:

```text
transactions/{transactionId}/evidence.webp
```

Object keys are generated by the server. User filenames are never trusted as storage paths.

Private evidence is accessed through authorization plus signed/private delivery.

---

## 17. Rate Limiting

Production rate limiting must be distributed; it cannot depend on one Next.js/Vercel instance keeping an in-memory counter.

Rate-limit targets:

```text
Authentication
Password-related actions
Upload/signing endpoints
Public APIs
External webhooks
Expensive exports/reports
```

Abstract the mechanism behind:

```text
src/lib/rate-limit/

checkRateLimit({ key, limit, window })
```

The feature code should not depend on a specific rate-limit provider. A distributed store such as Redis/KV can be introduced without rewriting business logic.

Local in-memory limiting is for development/testing only.

---

## 18. Scalability Architecture

The design should scale without a rewrite.

### Database

Use:

```text
indexes
constraints
pagination
aggregate queries
transactions
```

Avoid:

```text
N+1 queries
unbounded lists
full-table scans for every dashboard
client-side financial aggregation
```

### Pagination

Required for potentially large collections:

- transactions
- audit logs
- members
- project collections

### Aggregations

Prefer database aggregates over:

```text
fetch thousands of rows
-> calculate in React
```

### Caching

Cache only data where bounded staleness is acceptable. Do not cache authoritative approval state or financial truth in a way that can return stale financial results.

---

## 19. Performance Architecture

Priority order:

```text
1. Server rendering where practical
2. Small client bundles
3. Efficient SQL
4. Indexed filters
5. Pagination
6. Optimized images
7. Fewer network round trips
8. Safe caching
```

Critical routes:

```text
/login
/dashboard
/projects/[slug]
/projects/[slug]/transactions
/pending
```

Every data-driven screen supports:

```text
loading
success
empty
error
unauthorized
```

---

## 20. Frontend Architecture

PHANTOMS product UI uses:

```text
Font: Alexandria
Base: White / Off-white
Primary: Black
Accent: PHANTOMS Red
```

The product inherits PHANTOMS visual DNA but is a product UI, not a direct copy of the social-media editorial layout.

Component hierarchy:

```text
Design Tokens
   |
   v
Primitive UI
   |
   v
Feature Components
   |
   v
Pages
```

Example:

```text
Button
  -> ApproveButton
      -> ApprovalCard
          -> PendingPage
```

Business logic stays outside visual primitives.

---

## 21. Route Map

### Public / entry

```text
/
/login
```

### Authenticated

```text
/dashboard
/projects
/projects/[slug]
/projects/[slug]/transactions
/projects/[slug]/members
/projects/[slug]/settings
/pending
/settings
```

### Interaction surfaces

```text
Create Project
Edit Project
Add Payment
Add Withdrawal
Transaction Details
Approve Transaction
Reject Transaction
Add Member
Remove Member
Evidence Preview
```

Dialogs/sheets are preferred where the workflow does not benefit from a separate URL.

---

## 22. Public Web vs Private Application

Search visibility applies only to public content.

```text
Public surface
    -> SEO / Search / Discoverability

Private app
    -> Auth / Authorization / No public indexing
```

Financial pages must never become public SEO content.

Private routes remain protected by authentication and authorization; robots controls are not the security boundary.

---

## 23. Web SEO Architecture

For public pages, use Next.js metadata and explicit technical SEO:

```text
metadata
canonical URLs
Open Graph
robots.ts
sitemap.ts
semantic HTML
structured data where appropriate
internal linking
```

Each indexable page should have:

```text
unique title
useful description
canonical URL
semantic headings
crawlable links
real useful content
```

Do not create thin duplicate pages solely for keywords.

---

## 24. Google Search Console

Search Console belongs to the public-web operational layer.

Production setup:

```text
Verified property
  |
  +-- Sitemap
  +-- URL Inspection
  +-- Indexing monitoring
  +-- Search performance
  +-- Search issue alerts
```

Monitor at minimum:

```text
Clicks
Impressions
CTR
Queries
Pages
Countries
Indexing problems
```

Search Console is a measurement/debugging layer, not an access-control system.

---

## 25. GEO / AI Discoverability

GEO is treated as **content discoverability for search and AI systems**, not a ranking shortcut.

Public content should be:

```text
clear
factual
well structured
entity-explicit
semantically organized
internally linked
supported by structured data when appropriate
```

The same source content should be understandable by people, search engines, and AI systems. Do not generate hidden machine-only text or fake citations.

---

## 26. Security Architecture

Security is layered:

```text
Browser
  |
Authentication
  |
Authorization
  |
Validation
  |
Domain rules
  |
Database constraints
  |
Audit
```

Rules:

```text
No client-trusted roles
No client-trusted ownership
No plaintext passwords
No sensitive secrets in browser
No financial truth in React
No unrestricted evidence access
No self-approval
```

---

## 27. Observability

Production needs visibility into:

### Application

```text
request failures
server exceptions
auth failures
transaction failures
upload failures
slow operations
```

### Database

```text
connection failures
slow queries
migration failures
resource pressure
```

### Product

Safe aggregate metrics only:

```text
successful logins
failed logins
transactions created
transactions approved
transactions rejected
upload failures
```

Never log passwords, secrets, session tokens, or sensitive evidence URLs.

---

## 28. Testing Architecture

### Unit

```text
finance calculations
validation
permission helpers
pure domain rules
```

### Integration

```text
database repositories
authentication
authorization
transaction workflows
approval
audit
```

### E2E

Critical business path:

```text
Login
  -> Dashboard
  -> Project
  -> Submit Payment
  -> Pending
  -> Approve
  -> Project totals update
  -> Member balance update
  -> Audit record exists
```

Every discovered financial/security regression gets a regression test.

---

## 29. CI Quality Gate

Production-bound changes should pass:

```text
lint
typecheck
unit tests
integration tests
build
```

Release candidates should additionally run:

```text
E2E
migration verification
security checks
production smoke tests
```

---

## 30. Environment Architecture

```text
DEVELOPMENT
  Local Next.js
  Neon development branch/environment
  R2 development namespace

PREVIEW
  Vercel preview
  Isolated configuration
  Safe database/storage environment

PRODUCTION
  Vercel production
  Neon production
  R2 production
```

Local experimentation must not casually target production.

---

## 31. Migration Policy

Database changes are migration-driven:

```text
Edit schema
  -> Generate migration
  -> Review migration
  -> Test on development
  -> Validate
  -> Promote to production
```

Do not make ad-hoc production table edits as normal development practice.

Better Auth schema changes remain part of the same Drizzle migration strategy.

---

# 32. Master Development Phases

Each phase has **one mission only** and must have a clear exit condition before the next phase starts.

## PHASE 0 — FOUNDATION

**Mission:** Make the codebase clean, reproducible, and runnable.

Scope:

```text
repository structure
environment variables
TypeScript
lint/typecheck
Neon connection
Drizzle config
migration pipeline
base UI tokens
logging/error baseline
```

Exit:

```text
install -> dev -> lint -> typecheck -> build
```

---

## PHASE 1 — AUTHENTICATION

**Mission:** Make login and sessions real.

Scope:

```text
Better Auth
Drizzle adapter
auth schema
email/password
pre-provisioned users
sessions
logout
protected routes
login errors/loading
```

Exit:

```text
valid existing user -> login -> session -> /dashboard
unknown user -> rejected, no automatic signup
```

---

## PHASE 2 — TENANCY + AUTHORIZATION

**Mission:** Make every protected request organization/project aware.

Scope:

```text
organizations
organization_members
roles
project membership foundation
tenant guards
permission helpers
```

Exit:

```text
server knows current user + organization + project + permission
```

---

## PHASE 3 — PROJECT MANAGEMENT

**Mission:** Create the project container for all financial activity.

Scope:

```text
projects
project list
create/edit project
project overview shell
project settings
project membership
```

Exit:

```text
authorized user can create/access/update a project
```

---

## PHASE 4 — TRANSACTION LEDGER

**Mission:** Create the authoritative financial record system.

Scope:

```text
transactions
PAYMENT
WITHDRAWAL
PENDING
APPROVED
REJECTED
queries
validation
```

Exit:

```text
valid transaction can exist as PENDING
```

---

## PHASE 5 — PAYMENT FLOW

**Mission:** Complete payment submission into PENDING.

Scope:

```text
payment form
amount
paid_to
notes
submit
transaction history
duplicate-submit protection
```

Exit:

```text
member -> payment -> PENDING
```

---

## PHASE 6 — WITHDRAWAL FLOW

**Mission:** Complete controlled withdrawal submission.

Scope:

```text
withdrawal form
amount
paid_to
notes
submit
pending state
```

Exit:

```text
member -> withdrawal -> PENDING
```

---

## PHASE 7 — APPROVAL ENGINE

**Mission:** Control financial state transitions.

Scope:

```text
pending queue
approve
reject
self-approval prevention
atomic transaction
concurrency safety
```

Exit:

```text
eligible PENDING -> APPROVED/REJECTED atomically + audit event
```

---

## PHASE 8 — FINANCE ENGINE

**Mission:** Convert approved ledger records into authoritative financial calculations.

Scope:

```text
project totals
member totals
remaining budget
funding progress
target contribution
member balance
```

Exit:

```text
all financial summaries derive from approved transaction state
```

---

## PHASE 9 — EVIDENCE STORAGE

**Mission:** Attach secure evidence files to transactions.

Scope:

```text
Cloudflare R2
upload authorization
file validation
object keys
private/signed access
evidence preview
```

Exit:

```text
evidence securely stored outside PostgreSQL and accessible only to authorized users
```

---

## PHASE 10 — AUDITABILITY

**Mission:** Make important changes traceable.

Scope:

```text
audit_logs
transaction events
project events
membership events
actor attribution
old/new values
timestamps
```

Exit:

```text
important financial/security mutations can be reconstructed
```

---

## PHASE 11 — PRODUCT UI

**Mission:** Turn working backend capabilities into the complete PHANTOMS product UI.

Scope:

```text
dashboard
projects
project overview
transactions
members
pending
settings
loading/empty/error states
responsive UI
design system
```

Exit:

```text
core workflows can be completed without placeholder data
```

---

## PHASE 12 — SECURITY + RATE LIMITING

**Mission:** Harden the product against abuse and unauthorized actions.

Scope:

```text
rate limiting
authorization review
input validation review
session/security review
upload security
secret handling
security headers
abuse protection
concurrency review
```

Exit:

```text
security-sensitive workflows are protected and tested
```

---

## PHASE 13 — SCALABILITY + PERFORMANCE

**Mission:** Keep performance predictable as data grows.

Scope:

```text
DB indexes
pagination
query profiling
N+1 elimination
aggregate queries
cache review
bundle review
server/client boundary review
```

Exit:

```text
critical routes have bounded database and network work
```

---

## PHASE 14 — SEO + PUBLIC WEB

**Mission:** Make only the public web surface discoverable.

Scope:

```text
metadata
canonical URLs
Open Graph
robots.ts
sitemap.ts
semantic HTML
structured data where appropriate
internal links
public page performance
```

Exit:

```text
public pages are intentional search surfaces; private finance pages remain private
```

---

## PHASE 15 — SEARCH CONSOLE + GEO

**Mission:** Measure public search visibility and improve content clarity for search/AI systems.

Scope:

```text
Search Console verification
sitemap submission
URL inspection
indexing monitoring
query/page/country analysis
entity clarity
structured data
AI-readable content structure
```

Exit:

```text
public site is measurable in Search Console and its content structure is clear and trustworthy
```

---

## PHASE 16 — TESTING + RELEASE QUALITY

**Mission:** Prove the product is ready for release.

Scope:

```text
unit tests
integration tests
E2E tests
authorization tests
financial regression tests
migration tests
build verification
release smoke tests
```

Exit:

```text
critical workflows have repeatable automated verification
```

---

## PHASE 17 — OBSERVABILITY

**Mission:** Make production failures diagnosable.

Scope:

```text
server errors
auth failures
transaction failures
upload failures
slow operations
database health
deployment health
safe aggregate metrics
```

Exit:

```text
production incidents can be detected and traced without leaking sensitive data
```

---

## PHASE 18 — PRODUCTION INFRASTRUCTURE

**Mission:** Prepare an isolated, recoverable production environment.

Scope:

```text
Vercel
production env vars
Neon production
R2 production
domain/HTTPS
deployment pipeline
migration policy
backup/recovery procedure
```

Exit:

```text
production can be deployed independently of development
```

---

## PHASE 19 — GO-LIVE

**Mission:** Release Ledger V1 safely to the PHANTOMS team.

Scope:

```text
final QA
real users
real projects
production smoke test
monitoring
rollback readiness
```

Exit:

```text
Login
-> Project
-> Payment/Withdrawal
-> Pending
-> Approval/Reject
-> Updated finance
-> Audit history
```

with no known critical security or financial-integrity defect.

---

# 33. Production Definition

Ledger is **not** production-ready because the UI looks complete.

Production-ready means:

```text
AUTH
✓ login
✓ sessions
✓ pre-provisioned users
✓ protected routes

TENANCY
✓ organization isolation
✓ project membership
✓ server authorization

FINANCE
✓ payments
✓ withdrawals
✓ approvals
✓ exact calculations
✓ concurrency safety

STORAGE
✓ private R2 evidence
✓ authorized access

AUDIT
✓ financial history
✓ actor attribution

SECURITY
✓ rate limiting
✓ validation
✓ secret protection
✓ upload protection
✓ authorization tests

QUALITY
✓ unit
✓ integration
✓ E2E
✓ build

PERFORMANCE
✓ indexes
✓ pagination
✓ optimized queries

WEB
✓ public SEO where applicable
✓ Search Console
✓ sitemap
✓ structured data where appropriate
✓ private application protected

OPS
✓ monitoring
✓ recovery procedure
✓ production isolation
✓ deployment process

GO-LIVE
✓ smoke test
✓ real user flow
✓ rollback readiness
```

---

# 34. Non-Negotiable Rules

```text
1. PostgreSQL owns financial truth.
2. React never owns authoritative financial calculations.
3. Authentication and authorization are separate.
4. Authorization is always server-side.
5. Money uses exact representation.
6. Financial approvals are atomic.
7. Audit records are append-oriented.
8. Evidence bytes live in R2.
9. There is no public signup.
10. Development does not casually target production.
11. Large datasets are paginated.
12. N+1 queries are prohibited in performance-sensitive flows.
13. Production rate limiting is distributed.
14. Public SEO is separated from private finance data.
15. Search visibility never overrides privacy.
16. Critical finance/security bugs receive regression tests.
17. Every phase has one mission and one exit condition.
```

## Phase Execution Discipline

The roadmap is executed one phase at a time.

```text
Read current phase
    ↓
Inspect repository
    ↓
Implement current phase only
    ↓
Validate current phase
    ↓
Report results
    ↓
STOP
```

Do not automatically continue to the next phase.

Later-phase findings may be documented and deferred. Do not implement them unless they are required to complete the current phase.


