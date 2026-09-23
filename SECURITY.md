# SECURITY

```text
┌──────────────────────────────────────────────┐
│               PHANTOMS FINANCE               │
├──────────────────────────────────────────────┤
│                                              │
│   SECURITY                                   │
│   Security Requirements                      │
│                                              │
│   AuthZ · Tenant Isolation · Integrity       │
│   Validation · Uploads · Secrets             │
│                                              │
└──────────────────────────────────────────────┘
```

## 1. Security Objective

Protect:

```text
├── financial integrity
├── authentication
├── authorization
├── tenant isolation
├── private project information
├── evidence files
├── audit history
└── database credentials
```

## 2. Authentication

Better Auth handles authentication.

Required:

```text
├── secure session handling
├── secure cookies
├── production HTTPS
├── strong Better Auth secret
└── no auth secrets in source control
```

## 3. Authorization

Authorization is server-side. Always.

For every protected mutation:

```text
session
   ↓
organization membership
   ↓
project membership
   ↓
role/permission
   ↓
action-specific rule
   ↓
ALLOW / DENY
```

Never trust:

```text
├── hidden form inputs
├── client-side roles
├── URL parameters as authorization
├── localStorage permissions
└── React state as security state
```

## 4. Tenant Isolation

The system is multi-tenant at the data layer from day one.

```text
┌──────────────────────────────────────────────┐
│  ISOLATION RULE                              │
├──────────────────────────────────────────────┤
│                                              │
│  Every financial query resolves the          │
│  actor's organization FIRST.                 │
│                                              │
│  No organization_id in scope                 │
│        ⇒ no row is readable or writable      │
│                                              │
└──────────────────────────────────────────────┘
```

Enforced at:

```text
├── Domain services (authorization)
├── Repositories (query scoping)
└── Database constraints (organization_id NOT NULL)
```

One organization exists today. The boundary still applies. Cross-organization access must fail closed.

## 5. Self-Approval Prevention

```text
transaction.creator
        ≠
approval.actor
```

A transaction creator must not approve or reject their own transaction.

This is enforced on the server, inside the same database transaction as the approval.

## 6. Financial Integrity

Transactions are immutable in principle after approval.

If correction is required:

```text
preserve the original transaction
        ↓
create a compensating transaction
   or a controlled correction flow
        ↓
audit the operation
```

Do not silently rewrite historical financial data.

## 7. Input Validation

Validate all untrusted input with Zod.

Validate:

```text
├── amount
├── IDs
├── organization scope
├── slugs
├── notes
├── transaction type
└── file metadata
```

Notes are limited to 255 characters.

## 8. File Upload Security

Evidence uploads must:

```text
├── use allowed MIME types
├── have a strict size limit
├── receive generated object keys
├── never use user-provided filenames as trusted paths
├── be stored in R2
└── not expose private buckets directly
```

Prefer signed URLs for private evidence.

## 9. Database Security

```text
├── Parameterized queries through Drizzle
├── Never concatenate user input into SQL
├── Foreign keys and constraints
├── Database transactions for atomic workflows
├── organization_id NOT NULL on financial tables
└── Production migrations require review
```

## 10. Secrets

Never commit:

```text
├── DATABASE_URL
├── BETTER_AUTH_SECRET
├── R2 access keys
├── API tokens
└── OAuth client secrets
```

Use environment variables.

## 11. XSS / Injection

```text
├── Use React's default escaping
├── Avoid dangerouslySetInnerHTML
├── Sanitize HTML if it ever becomes necessary
└── Never interpolate untrusted input into scripts
```

## 12. CSRF

Use framework/authentication mechanisms appropriate to the request path. Do not create custom cookie-based mutation endpoints without understanding CSRF implications.

## 13. Rate Limiting

Future public-facing endpoints should have rate limiting.

Especially:

```text
├── login
├── password reset
├── upload
└── high-cost APIs
```

## 14. Logging

Never log:

```text
├── passwords
├── session secrets
├── API keys
├── full private evidence URLs
└── sensitive personal data unnecessarily
```

Audit logs record security-relevant financial actions.

## 15. Security Checklist

Before production:

```text
[ ] HTTPS
[ ] production secrets configured
[ ] no secrets in Git
[ ] authorization tested
[ ] tenant isolation tested (cross-org access fails)
[ ] self-approval tested
[ ] evidence access tested
[ ] file upload restrictions tested
[ ] SQL injection paths reviewed
[ ] XSS paths reviewed
[ ] dependency audit reviewed
[ ] production DB not used for local experimentation
```
