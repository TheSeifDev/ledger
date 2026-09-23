# Ledger

Internal finance and project ledger for PHANTOMS.

Ledger centralizes project budgets, member contributions, withdrawals, approvals, evidence, balances, and financial audit history.

## Stack

- Next.js
- TypeScript
- React
- Neon PostgreSQL
- Drizzle ORM
- Better Auth
- Cloudflare R2
- Zod
- Tailwind CSS
- shadcn/ui
- Lucide
- Vercel

## Product Flow

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

## Core Roles

| Role | Access |
|---|---|
| OWNER | Full control |
| HEAD | Review and approve/reject |
| MEMBER | View authorized projects and submit transactions |

A user cannot approve their own transaction.

## Financial Model

For approved transactions:

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

## Development

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

## Database

Local development should use a dedicated Neon development branch.

Production should use the production Neon branch.

Drizzle is responsible for application/database migrations.

Do not use direct Better Auth migration commands for the Drizzle-backed setup.

## Environment Variables

Typical variables:

```env
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

# R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

Never commit real values.

## Project Structure

```text
src/
├── app/
├── actions/
├── components/
├── db/
│   └── schema/
├── lib/
│   ├── auth/
│   ├── finance/
│   ├── permissions/
│   ├── storage/
│   └── validation/
└── types/
```

## Documentation

- `AGENTS.md` — coding-agent/project instructions
- `CLAUDE.md` — Claude-specific execution guidance
- `PRD.md` — product requirements
- `ARCHITECTURE.md` — technical architecture
- `DESIGN_SYSTEM.md` — UI/UX rules
- `SECURITY.md` — security requirements
- `CODE_STYLE.md` — coding conventions
- `TESTING.md` — testing strategy

## Quality Gate

Before considering a feature complete:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run only the commands that exist in `package.json`.

## Security

Financial data is sensitive.

Never:
- trust client authorization
- expose secrets
- use floating point for money
- silently rewrite approved history
- store evidence binaries in PostgreSQL
- bypass audit logging
- run destructive production migrations casually

## Status

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
