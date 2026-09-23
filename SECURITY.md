# Security

## Security Objective

Protect:
- financial integrity
- authentication
- authorization
- private project information
- evidence files
- audit history
- database credentials

## Authentication

Better Auth handles authentication.

Required:
- secure session handling
- secure cookies
- production HTTPS
- strong Better Auth secret
- no auth secrets in source control

## Authorization

Authorization is server-side.

For every protected mutation:

```text
session
→ organization membership
→ project membership
→ role/permission
→ action-specific rule
```

Never trust:
- hidden form inputs
- client-side roles
- URL parameters as authorization
- localStorage permissions
- React state as security state

## Self-Approval Prevention

A transaction creator must not approve or reject their own transaction.

This must be enforced on the server.

## Financial Integrity

Transactions are immutable in principle after approval.

If correction is required:
- preserve the original transaction
- create a compensating transaction or controlled correction flow
- audit the operation

Do not silently rewrite historical financial data.

## Input Validation

Validate all untrusted input with Zod.

Validate:
- amount
- IDs
- slugs
- notes
- transaction type
- file metadata

Notes are limited to 255 characters.

## File Upload Security

Evidence uploads must:
- use allowed MIME types
- have a strict size limit
- receive generated object keys
- never use user-provided filenames as trusted paths
- be stored in R2
- not expose private buckets directly

Prefer signed URLs for private evidence.

## Database Security

- Use parameterized queries through Drizzle.
- Never concatenate user input into SQL.
- Use foreign keys and constraints.
- Use database transactions for atomic financial workflows.
- Production migrations require review.

## Secrets

Never commit:
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- R2 access keys
- API tokens
- OAuth client secrets

Use environment variables.

## XSS / Injection

- Use React's default escaping.
- Avoid `dangerouslySetInnerHTML`.
- If HTML rendering becomes necessary, sanitize it first.
- Never interpolate untrusted input into scripts.

## CSRF

Use framework/authentication mechanisms appropriate to the request path. Do not create custom cookie-based mutation endpoints without understanding CSRF implications.

## Rate Limiting

Future public-facing endpoints should have rate limiting.

Especially:
- login
- password reset
- upload
- high-cost APIs

## Logging

Never log:
- passwords
- session secrets
- API keys
- full private evidence URLs
- sensitive personal data unnecessarily

Audit logs should record security-relevant financial actions.

## Security Checklist

Before production:

- [ ] HTTPS
- [ ] production secrets configured
- [ ] no secrets in Git
- [ ] authorization tested
- [ ] self-approval tested
- [ ] evidence access tested
- [ ] file upload restrictions tested
- [ ] SQL injection paths reviewed
- [ ] XSS paths reviewed
- [ ] dependency audit reviewed
- [ ] production DB is not used for local experimentation
