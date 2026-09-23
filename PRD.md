# PRD — LEDGER

```text
┌──────────────────────────────────────────────┐
│               PHANTOMS FINANCE               │
├──────────────────────────────────────────────┤
│                                              │
│   PRD                                        │
│   Product Requirements                       │
│                                              │
│   Problem · Users · Concepts · Rules         │
│   MVP · Acceptance Criteria                  │
│                                              │
└──────────────────────────────────────────────┘
```

## 1. Product Overview

Ledger is the internal financial management platform for PHANTOMS.

It provides a reliable ledger for project budgets, member payments, withdrawals, approvals, balances, evidence, and audit history.

```text
Internal-first

NOT a public banking product
NOT a public accounting product
```

## 2. Positioning

```text
PHANTOMS Finance
        ↓
Team Finance Platform
        ↓
Multi-Organization SaaS   ← future, not now
```

### Scope Ladder

Possible future features:

```text
Organizations   ✅ schema-ready day one
Teams           ⬜ future
Projects        ✅ MVP
Budgets         ✅ MVP (project budget)
Members         ✅ MVP
Expenses        ✅ MVP (transactions)
Approvals       ✅ MVP
Reports         ✅ basic dashboards
Audit Logs      ✅ MVP
```

### The Decision

```text
┌──────────────────────────────────────────────┐
│  DO NOT build the SaaS complexity now        │
├──────────────────────────────────────────────┤
│                                              │
│  Just make the database architecture         │
│  multi-tenant from day one.                  │
│                                              │
└──────────────────────────────────────────────┘
```

## 3. Problem

PHANTOMS projects have shared budgets and multiple members contributing or spending money. Manual tracking through chats, spreadsheets, and messages creates problems:

```text
├── unclear project balance
├── unclear individual contribution
├── missing payment evidence
├── difficult approval workflow
├── inconsistent calculations
└── poor historical traceability
```

Ledger centralizes the financial state.

## 4. Goals

### Primary Goals

```text
├── Track project budgets
├── Track member payments
├── Track project withdrawals
├── Require review before approval
├── Calculate balances automatically
├── Preserve evidence
├── Preserve an audit trail
└── Provide role-based access
```

### Non-Goals

```text
├── Banking
├── Payment processing
├── Card issuing
├── Payroll
├── Tax accounting
├── Public financial reporting
├── Cryptocurrency
└── Automatic bank reconciliation
```

## 5. Users

```text
OWNER
    ↓
Full organization control
Projects · Members · Finance · Approvals

HEAD
    ↓
Review project financial activity
Approve / Reject transactions

MEMBER
    ↓
View authorized projects
Submit payments / withdrawals
```

## 6. Core Concepts

### Organization

The PHANTOMS organization. The tenant root. Exists from day one in the schema, even while only one organization is in use.

### Project

A project has:

```text
├── name
├── slug
├── description
├── total budget
├── currency
├── status
└── members
```

Example:

```text
Project:        Rafiq
Budget:         15,000 EGP
Members:        30
Target/member:  500 EGP
```

### Transaction

A transaction belongs to exactly one project.

```text
Types
├── PAYMENT        money in
└── WITHDRAWAL     money out

Statuses
├── PENDING        awaiting review
├── APPROVED       part of the ledger
└── REJECTED       history only
```

A transaction includes:

```text
├── actor/member
├── amount
├── paid_to
├── notes
├── optional evidence
├── status
├── approver
└── approval timestamp
```

## 7. Functional Requirements

### Authentication

```text
User
  ↓
must authenticate
  ↓
protected resources
```

Users must authenticate before accessing protected resources.

### Project Access

Users can only access projects for which they have valid organization/project membership.

### Submit Payment

```text
Member
  ↓
select amount
  ↓
specify recipient (paid_to)
  ↓
add optional notes
  ↓
attach optional evidence
  ↓
status = PENDING
```

The project is determined by the project route/context.

### Submit Withdrawal

A member with permission can submit a withdrawal.

```text
New transaction status = PENDING
```

### Approval

Owner/Head can approve or reject eligible transactions.

```text
A user cannot approve their own transaction.
```

Approved transaction:

```text
├── affects financial totals
└── becomes part of the authoritative ledger
```

Rejected transaction:

```text
└── does not affect approved financial totals
```

### Project Financial Summary

Show:

```text
├── total budget
├── approved payments
├── approved withdrawals
├── net collected
├── remaining budget
├── funding progress
└── pending transaction amount
```

### Member Summary

Show:

```text
├── target contribution
├── approved payments
├── approved withdrawals
├── net contribution
└── remaining balance
```

## 8. Business Rules

```text
├── Money is stored exactly (integer minor units)
├── PENDING never affects approved balances
├── REJECTED never affects approved balances
├── A withdrawal is never treated as available money
└── All approval operations are auditable
```

## 9. MVP

MVP flow:

```text
Login
→ Dashboard
→ Project
→ Submit Payment
→ Pending
→ Head/Owner Approval
→ Updated Ledger
→ Updated Member/Project Balance
```

Then:

```text
├── withdrawal
├── evidence
├── audit log
├── project/member dashboards
├── filtering
└── polished UI
```

## 10. Acceptance Criteria

A payment:

```text
├── cannot be submitted without valid amount
├── cannot bypass authentication
├── cannot target an unauthorized project
├── starts as PENDING
└── only approved payment affects approved totals
```

An approval:

```text
├── requires authorization
├── cannot approve the actor's own transaction
├── changes status atomically
├── records approver and timestamp
└── creates an audit event
```

A rejected transaction:

```text
├── remains historical
└── does not affect approved totals
```

## 11. Future Features

```text
├── CSV export
├── monthly reporting
├── notifications
├── recurring project expenses
├── richer analytics
├── approval comments
├── budget alerts
├── configurable currencies
├── teams
└── multi-organization surface
```
