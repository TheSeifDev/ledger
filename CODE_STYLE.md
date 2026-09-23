# CODE STYLE

```text
┌──────────────────────────────────────────────┐
│               PHANTOMS FINANCE               │
├──────────────────────────────────────────────┤
│                                              │
│   CODE STYLE                                 │
│   Coding Conventions                         │
│                                              │
│   TypeScript · Naming · Functions            │
│   Actions · Validation · Git                 │
│                                              │
└──────────────────────────────────────────────┘
```

## 1. TypeScript

Use strict TypeScript.

Prefer:

```ts
type TransactionStatus = "PENDING" | "APPROVED" | "REJECTED";
```

over unrestricted strings.

Avoid:

```ts
any
```

unless there is a documented reason.

## 2. Naming

```text
PascalCase        Components / classes
camelCase         variables / functions
UPPER_SNAKE_CASE  constants
kebab-case        URL slugs
```

Examples:

```text
TransactionTable
calculateProjectBalance
MAX_NOTE_LENGTH
rafiq
```

## 3. Functions

Prefer small functions with one responsibility.

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

## 4. Imports

Prefer path aliases:

```ts
import { db } from "@/db";
```

Avoid deep relative imports when an alias is available.

## 5. React

Prefer Server Components.

Use:

```tsx
"use client";
```

only when necessary for:

```text
├── state
├── effects
├── browser APIs
└── interactive client-only libraries
```

## 6. Server Actions

Actions should be thin.

```text
submitPaymentAction
   ↓
authenticate
   ↓
validate
   ↓
authorize (org + project + role)
   ↓
finance service
   ↓
return safe result
```

Do not place large SQL/business workflows directly in the action.

## 7. Error Handling

Use typed/domain errors where practical.

Do not expose to users:

```text
├── SQL errors
├── stack traces
├── internal paths
└── secrets
```

Return user-safe messages and log internal details appropriately.

## 8. Validation

Zod schemas live close to the domain boundary.

Example:

```ts
const paymentSchema = z.object({
  amountMinorUnits: z.number().int().positive(),
  paidTo: z.string().min(1).max(255),
  notes: z.string().max(255).optional(),
});
```

## 9. Database

Do not query the database directly from UI components.

Keep database access in `src/db` or domain repositories/services.

Every financial query is organization-scoped:

```text
db.select()
  .from(transactions)
  .where(eq(transactions.organizationId, org.id))   // always
```

## 10. Comments

Write comments for:

```text
├── why something exists
├── non-obvious business rules
└── security constraints
```

Do not comment obvious syntax.

## 11. Git

Commit messages describe intent.

Examples:

```text
feat(finance): add transaction submission
fix(auth): enforce project membership
refactor(finance): isolate approval service
test(finance): cover self-approval rejection
docs: update architecture
```

## 12. Formatting

Use the project's configured formatter/linter.

Do not introduce competing formatting tools without a project-level decision.
