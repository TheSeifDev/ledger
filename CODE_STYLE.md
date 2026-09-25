# CODE STYLE

```text
┌──────────────────────────────────────────────────────────────┐
│                        PHANTOMS LEDGER                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  CODE STYLE                                                  │
│  Engineering Conventions                                     │
│                                                              │
│  TypeScript · Architecture · Naming · Server/Client         │
│  Actions · Services · Validation · Database · Git            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 1. Purpose

This document defines the coding conventions for Ledger.

The goal is:

```text
Readable
Predictable
Type-safe
Secure
Testable
Scalable
```

Code should match the repository architecture and never bypass its boundaries for convenience.

---

# 2. Repository Structure

The repository intentionally uses root-level:

```text
app/
components/
lib/
```

and backend internals under:

```text
src/
├── actions/
├── db/
├── server/
└── types/
```

Full structure:

```text
ledger/
├── app/
├── components/
├── lib/
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
├── public/
├── drizzle.config.ts
└── ...
```

### Important

Do NOT move:

```text
app/
components/
lib/
```

into:

```text
src/
```

Do NOT create:

```text
src/app/
src/components/
src/lib/
```

unless a future architecture decision explicitly changes the repository contract.

---

# 3. Dependency Direction

Code should follow:

```text
app / components
        ↓
actions / route handlers
        ↓
server services
        ↓
domain modules
        ↓
repositories
        ↓
Drizzle
        ↓
PostgreSQL
```

## Forbidden

```text
React component → Drizzle
React component → PostgreSQL
Client code → server secrets
UI → raw financial SQL
UI → authorization decisions
```

A component may receive server-derived data as props.

A component must not become the source of financial truth.

---

# 4. TypeScript

Use strict TypeScript.

Prefer explicit domain types:

```ts
type TransactionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

type TransactionType =
  | "PAYMENT"
  | "WITHDRAWAL";
```

Prefer narrow types over unrestricted strings.

Avoid:

```ts
any
```

unless there is a documented technical reason.

Do not weaken compiler settings to make code compile.

Prefer:

```ts
unknown
```

when the input type is genuinely unknown, followed by validation/narrowing.

---

# 5. Naming

Use:

```text
PascalCase
  Components
  Classes
  Domain types

camelCase
  variables
  functions
  action names

UPPER_SNAKE_CASE
  constants

kebab-case
  URL slugs
  public route segments where appropriate
```

Examples:

```text
TransactionTable
ApprovalResult
calculateProjectBalance
submitPaymentAction
MAX_NOTE_LENGTH
rafiq
```

## Boolean Names

Prefer:

```text
isApproved
hasAccess
canApprove
isPending
```

Avoid ambiguous names:

```text
approved
access
allowed
```

when the boolean meaning is not obvious.

---

# 6. File Naming

Use predictable names.

Components:

```text
PascalCase.tsx
```

Examples:

```text
TransactionTable.tsx
ProjectHeader.tsx
ApprovalCard.tsx
```

Functions/modules:

```text
kebab-case.ts
```

Examples:

```text
transaction-service.ts
permission-checks.ts
rate-limit.ts
```

Follow the existing directory convention when a module is already established.

Do not create multiple naming systems for the same layer.

---

# 7. Functions

Functions should have one clear responsibility.

Bad:

```text
processEverything()
```

Better:

```text
validateTransactionInput()
authorizeTransactionApproval()
approveTransaction()
createAuditLog()
```

Prefer:

```text
small
composable
deterministic
testable
```

over giant functions.

Avoid functions that:

```text
authenticate
validate
query five unrelated tables
calculate finance
send email
and render UI
```

all at once.

---

# 8. Business Logic

Business rules belong outside UI.

Financial logic belongs in:

```text
lib/finance/
```

Authorization logic belongs in:

```text
lib/permissions/
src/server/guards/
```

Server orchestration belongs in:

```text
src/server/services/
```

Database access belongs in:

```text
src/server/repositories/
src/db/
```

The React layer should compose and display results.

---

# 9. React

Server Components are the default.

Use:

```tsx
"use client";
```

only when necessary for:

```text
state
effects
browser APIs
event-heavy interaction
client-only libraries
```

Do not make a page a Client Component just because one child needs interactivity.

Prefer:

```text
Server page
   ↓
Client interactive island
```

over:

```text
Entire page as Client Component
```

---

# 10. Components

Components should have clear responsibilities.

Prefer:

```text
TransactionTable
TransactionRow
TransactionStatus
ApprovalCard
```

over:

```text
MegaTransactionComponent
```

Reusable UI primitives belong in:

```text
components/ui/
```

Feature-specific components belong in:

```text
components/auth/
components/dashboard/
components/projects/
components/transactions/
components/members/
```

Do not put business services inside components.

---

# 11. Server Actions

Server Actions are thin application entry points.

Expected structure:

```text
submitPaymentAction
      ↓
authenticate
      ↓
validate input
      ↓
resolve organization/project
      ↓
authorize
      ↓
call service
      ↓
return safe result
```

Actions should NOT contain large SQL or complicated financial workflows.

Prefer:

```text
Action
  → Service
  → Repository
```

rather than:

```text
Action
  → 200 lines of SQL/business logic
```

---

# 12. Route Handlers

Use Route Handlers for:

```text
Better Auth
webhooks
external integrations
special API endpoints
signed upload workflows
```

Do not duplicate an existing Server Action with a second endpoint unless there is a concrete consumer requiring it.

Validate every external request.

---

# 13. Authentication

Better Auth owns:

```text
password hashing
password verification
sessions
session cookies
authentication state
```

Do NOT implement:

```text
custom password hashing
custom auth cookies
localStorage auth tokens
manual session tokens
```

Ledger has no public signup.

Never automatically create a user during login.

---

# 14. Authorization

Authentication:

```text
Who are you?
```

Authorization:

```text
What can you do?
```

Authorization is server-side.

Never trust:

```text
client role
client user_id
client organization_id
client project_id
hidden form inputs
localStorage permissions
React state
URL alone
```

Every protected mutation must:

```text
authenticate
→ resolve organization
→ resolve project
→ authorize
→ execute
```

---

# 15. Multi-Tenancy

Every tenant-owned financial query must be organization-scoped.

Expected pattern:

```ts
where(
  and(
    eq(transactions.organizationId, organizationId),
    eq(transactions.projectId, projectId),
  ),
);
```

Do not query:

```ts
transactions.where(eq(transactions.id, transactionId))
```

without first ensuring the transaction belongs to the authorized organization/project context.

## Rule

Resource ID alone is not authorization.

---

# 16. Validation

Use Zod at trust boundaries.

Example:

```ts
const paymentSchema = z.object({
  amountMinorUnits: z.number().int().positive(),
  paidTo: z.string().min(1).max(255),
  notes: z.string().max(255).optional(),
});
```

Validate:

```text
form input
API input
URL-derived identifiers where needed
file metadata
external webhook payloads
```

Do not assume TypeScript types validate runtime data.

---

# 17. Financial Amounts

Never use JavaScript floating-point arithmetic for authoritative finance.

Preferred:

```ts
amountMinorUnits: number;
```

Example:

```text
750.00 EGP → 75000
```

Do not use:

```ts
parseFloat()
```

for financial truth.

Avoid:

```ts
const total = 0.1 + 0.2;
```

for authoritative finance calculations.

Use integer minor units or exact PostgreSQL numeric representations.

---

# 18. Financial Queries

Do not calculate authoritative financial totals in React.

Bad:

```text
fetch 10,000 transactions
→ sum in component
```

Better:

```text
PostgreSQL aggregate
→ finance service
→ typed result
→ UI
```

Use aggregate SQL for:

```text
payments
withdrawals
pending counts
project totals
member totals
```

---

# 19. Database Access

UI components must never query the database directly.

Keep database access in:

```text
src/db/
src/server/repositories/
```

Repository functions should be explicit.

Prefer:

```text
getProjectBySlugForOrganization()
getPendingTransactionsForProject()
getMemberFinancialSummary()
```

over:

```text
queryEverything()
```

Every query touching financial/tenant data must include the appropriate organization/project scope.

---

# 20. Database Transactions

Use database transactions for multi-step operations requiring atomicity.

Example approval:

```text
BEGIN
→ verify PENDING
→ verify permission
→ update transaction
→ insert audit event
→ COMMIT
```

Do not implement:

```text
update transaction
await ...
insert audit later
```

when both operations must be atomic.

---

# 21. Idempotency

Financial mutations must consider retries.

Potential duplicate sources:

```text
double click
browser retry
network retry
refresh
request replay
```

Use an idempotency strategy where appropriate.

Do not create duplicate financial records because the client retried a request.

---

# 22. Concurrency

Assume financial records can be changed concurrently.

Example:

```text
Reviewer A → approves
Reviewer B → approves at same time
```

Database state must guarantee that only one valid transition occurs.

Do not rely only on:

```text
button disabled
React state
optimistic UI
```

to prevent duplicate approvals.

The server/database owns concurrency safety.

---

# 23. Audit

Important financial state transitions require audit events.

Examples:

```text
TRANSACTION_CREATED
TRANSACTION_APPROVED
TRANSACTION_REJECTED
PROJECT_CREATED
PROJECT_UPDATED
MEMBER_ADDED
MEMBER_REMOVED
```

Do not log:

```text
passwords
tokens
secrets
private credentials
```

Audit behavior belongs to the server/domain workflow, not the UI.

---

# 24. Evidence / R2

PostgreSQL stores:

```text
evidence_key
```

R2 stores:

```text
file bytes
```

Do not store binary evidence in PostgreSQL.

Use server-generated object keys:

```text
transactions/{transactionId}/evidence.webp
```

User filenames must not become trusted object paths.

---

# 25. Error Handling

Use explicit domain/application errors where useful.

Do not expose:

```text
SQL errors
stack traces
internal paths
framework errors
server secrets
```

to users.

Return safe user-facing messages.

Internally, retain enough diagnostics for observability without logging secrets.

Prefer error categories such as:

```text
ValidationError
UnauthorizedError
ForbiddenError
NotFoundError
ConflictError
RateLimitError
StorageError
```

---

# 26. Error Boundaries

Data-driven routes should have intentional:

```text
loading
error
empty
unauthorized
```

states.

Financial mutation UI should also represent:

```text
submitting
success
validation error
authorization error
conflict
server error
```

Do not silently swallow failures.

---

# 27. Imports

Prefer project aliases:

```ts
import { db } from "@/db";
import { approveTransaction } from "@/lib/finance/approvals";
```

Avoid unnecessary deep relative imports:

```ts
../../../../server/repositories/...
```

Do not create import cycles.

If a module becomes difficult to import cleanly, reconsider the dependency direction rather than adding more aliases.

---

# 28. Comments

Write comments for:

```text
why something exists
non-obvious business rules
security constraints
concurrency assumptions
workarounds for external/library behavior
```

Do NOT write comments that merely restate obvious code.

Bad:

```ts
// Add 1 to count
count += 1;
```

Good:

```ts
// Approval and audit must stay in the same DB transaction
// so financial state can never exist without its audit event.
```

---

# 29. Constants

Centralize meaningful constants.

Example:

```ts
const MAX_NOTE_LENGTH = 255;
```

Avoid unexplained magic numbers:

```ts
if (notes.length > 255) {}
```

when the value has domain meaning.

---

# 30. Async Code

Prefer clear `async/await`.

Avoid unnecessary promise chains.

Handle expected failures explicitly.

Do not fire-and-forget critical financial work.

For example, do NOT:

```ts
approveTransaction();
createAuditLog();
```

without awaiting/transactionally coordinating operations that must succeed together.

---

# 31. Server/Client Data Transfer

Only send data the browser actually needs.

Do not send:

```text
database credentials
internal IDs not required by the UI
private server metadata
authorization internals
sensitive audit payloads
```

Use typed DTOs/view models where the raw database row contains more information than the UI should receive.

---

# 32. Database Schema Style

Schema definitions should be:

```text
explicit
typed
constrained
indexed according to query patterns
```

Use meaningful database names.

Prefer:

```text
organization_id
project_id
amount_minor_units
approved_at
created_at
updated_at
```

Keep timestamps consistent across tables.

---

# 33. Queries and Performance

Avoid N+1 queries.

Bad:

```text
get projects
→ query members for each project
→ query transactions for each project
```

Prefer:

```text
joined/aggregated/batched query strategy
```

based on actual data needs.

Large collections must be:

```text
paginated
bounded
filtered
```

Do not return unlimited transaction history.

---

# 34. Rate Limiting

Rate limiting belongs behind an application abstraction.

Use:

```text
lib/rate-limit/
```

Business code should not depend directly on a provider-specific Redis/KV API.

Production rate limiting must be distributed.

Do not rely on process memory on Vercel as the production source of truth for rate limits.

---

# 35. SEO Code

SEO concerns belong to public web surfaces.

Use Next.js metadata APIs.

Keep private finance pages non-public/non-indexable.

Public SEO code belongs with:

```text
app/
lib/seo/
```

Do not create SEO content inside authenticated finance pages merely for rankings.

---

# 36. Git Commits

Commit messages describe intent.

Preferred format:

```text
type(scope): intent
```

Examples:

```text
feat(auth): wire pre-provisioned login
feat(finance): add transaction submission
feat(projects): add project creation
fix(auth): enforce protected route access
fix(finance): prevent self-approval
refactor(finance): isolate approval service
test(finance): cover withdrawal calculations
test(auth): cover invalid credentials
docs: update architecture
chore(db): add drizzle migration
```

Avoid:

```text
update
changes
fix stuff
final
final2
important
```

---

# 37. Pull Requests

A PR should explain:

```text
What changed?
Why?
What files/layers changed?
What was tested?
Any database migration?
Any security impact?
Any performance impact?
```

If financial behavior changed, explicitly document the affected business rule.

---

# 38. Formatting

Use the project's configured formatter/linter.

Do not introduce a second formatting system without an explicit project-level decision.

Formatting should be deterministic.

Before committing:

```text
lint
typecheck
tests relevant to the change
build where appropriate
```

---

# 39. Dependency Rules

Before adding a dependency, check:

```text
Does Next.js already provide this?
Does React already provide this?
Do we already have a dependency for it?
Can a small local utility handle it safely?
```

Avoid unnecessary dependencies.

Do not add a package solely to avoid writing a few lines of straightforward code.

For security updates, inspect the dependency graph before accepting automated major/breaking changes.

Never blindly run:

```bash
npm audit fix --force
```

---

# 40. Documentation

Update documentation when changing:

```text
architecture
database schema
financial rules
security rules
routes
environment variables
deployment
major dependencies
```

At minimum, keep aligned:

```text
ARCHITECTURE.md
AGENTS.md
PRD.md
CODE_STYLE.md
SECURITY.md
TESTING.md
```

Do not allow documentation to describe an architecture that the code no longer follows.

---

# 41. Phase Discipline

The project is built one phase at a time.

When a phase file is supplied:

```text
Read
 ↓
Inspect
 ↓
Implement only current phase
 ↓
Validate
 ↓
Report
 ↓
Stop
```

Do not implement later phases because they appear convenient.

If a later-phase issue is discovered:

```text
document
defer
continue current phase
```

unless it is a hard blocker for the current phase.

---

# 42. Clean Code Checklist

Before considering code complete:

```text
[ ] Clear names
[ ] Small focused functions
[ ] No giant components
[ ] No giant Server Actions
[ ] No business logic in UI
[ ] No direct DB from UI
[ ] No duplicated authorization
[ ] Zod at trust boundaries
[ ] Exact money handling
[ ] Organization/project scoping
[ ] Concurrency considered
[ ] Idempotency considered
[ ] Errors handled intentionally
[ ] Secrets protected
[ ] Relevant tests added
[ ] Documentation updated when needed
```

---

# 43. Definition of Done

A change is complete only when:

```text
├── TypeScript passes
├── Lint passes
├── Relevant tests pass
├── Build passes
├── Database changes have reproducible migrations
├── Server authorization is enforced
├── Organization/project scope is enforced
├── Financial calculations are deterministic
├── Financial mutations are concurrency-safe
├── Required audit behavior is correct
├── No secrets are committed
├── No accidental production DB mutation occurred
├── Performance implications were reviewed
└── Documentation matches implementation
```
