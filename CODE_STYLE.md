# Code Style

## TypeScript

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

## Naming

Use:

```text
PascalCase      Components / classes
camelCase       variables / functions
UPPER_SNAKE_CASE constants
kebab-case      URL slugs
```

Examples:

```text
TransactionTable
calculateProjectBalance
MAX_NOTE_LENGTH
rafiq
```

## Functions

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

## Imports

Prefer path aliases:

```ts
import { db } from "@/db";
```

Avoid deep relative imports when an alias is available.

## React

Prefer Server Components.

Use:

```tsx
"use client";
```

only when necessary for:
- state
- effects
- browser APIs
- interactive client-only libraries

## Server Actions

Actions should be thin.

Example structure:

```text
submitPaymentAction
→ authenticate
→ validate
→ authorize
→ finance service
→ return safe result
```

Do not place large SQL/business workflows directly in the action.

## Error Handling

Use typed/domain errors where practical.

Do not expose:
- SQL errors
- stack traces
- internal paths
- secrets

to users.

Return user-safe messages and log internal details appropriately.

## Validation

Zod schemas should live close to the domain boundary.

Example:

```ts
const paymentSchema = z.object({
  amountMinorUnits: z.number().int().positive(),
  paidTo: z.string().min(1).max(255),
  notes: z.string().max(255).optional(),
});
```

## Database

Do not query the database directly from UI components.

Keep database access in `src/db` or domain repositories/services.

## Comments

Write comments for:
- why something exists
- non-obvious business rules
- security constraints

Do not comment obvious syntax.

## Git

Commit messages should describe intent.

Examples:

```text
feat(finance): add transaction submission
fix(auth): enforce project membership
refactor(finance): isolate approval service
test(finance): cover self-approval rejection
docs: update architecture
```

## Formatting

Use the project's configured formatter/linter.

Do not introduce competing formatting tools without a project-level decision.
