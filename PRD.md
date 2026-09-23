# PRD — Ledger

## 1. Product Overview

Ledger is the internal financial management platform for PHANTOMS.

It provides a reliable ledger for project budgets, member payments, withdrawals, approvals, balances, evidence, and audit history.

The system is internal-first. It is not a public banking or accounting product.

## 2. Problem

PHANTOMS projects may have shared budgets and multiple members contributing or spending money. Manual tracking through chats, spreadsheets, and messages creates problems:

- unclear project balance
- unclear individual contribution
- missing payment evidence
- difficult approval workflow
- inconsistent calculations
- poor historical traceability

Ledger centralizes the financial state.

## 3. Goals

### Primary Goals

- Track project budgets.
- Track member payments.
- Track project withdrawals.
- Require review before financial transactions become approved.
- Calculate project and member balances automatically.
- Preserve evidence.
- Preserve an audit trail.
- Provide role-based access.

### Non-Goals

- Banking.
- Payment processing.
- Card issuing.
- Payroll.
- Tax accounting.
- Public financial reporting.
- Cryptocurrency.
- Automatic bank reconciliation.

## 4. Users

### Owner

Owns the organization and controls projects, members, and financial approvals.

### Head

Reviews project financial activity and approves/rejects transactions.

### Member

Views authorized project information and submits payments/withdrawals.

## 5. Core Concepts

### Organization

The PHANTOMS organization.

### Project

A project has:
- name
- slug
- description
- total budget
- currency
- status
- members

Example:

```text
Project: Rafiq
Budget: 15,000 EGP
Members: 30
Target/member: 500 EGP
```

### Transaction

A transaction belongs to exactly one project.

Types:

- PAYMENT
- WITHDRAWAL

Statuses:

- PENDING
- APPROVED
- REJECTED

A transaction includes:
- actor/member
- amount
- paid_to
- notes
- optional evidence
- status
- approver
- approval timestamp

## 6. Functional Requirements

### Authentication

Users must authenticate before accessing protected resources.

### Project Access

Users can only access projects for which they have valid organization/project membership.

### Submit Payment

A member can:
- select amount
- specify recipient (`paid_to`)
- add optional notes
- attach optional evidence

The project is determined by the project route/context.

New transaction status:

`PENDING`

### Submit Withdrawal

A member with permission can submit a withdrawal.

New transaction status:

`PENDING`

### Approval

Owner/Head can approve or reject eligible transactions.

A user cannot approve their own transaction.

Approved transaction:
- affects financial totals
- becomes part of the authoritative ledger

Rejected transaction:
- does not affect approved financial totals

### Project Financial Summary

Show:
- total budget
- approved payments
- approved withdrawals
- net collected
- remaining budget
- funding progress
- pending transaction amount

### Member Summary

Show:
- target contribution
- approved payments
- approved withdrawals
- net contribution
- remaining balance

## 7. Business Rules

Money is stored exactly.

Pending/rejected transactions do not affect approved balances.

A withdrawal cannot be treated as available money.

All approval operations must be auditable.

## 8. MVP

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

- withdrawal
- evidence
- audit log
- project/member dashboards
- filtering
- polished UI

## 9. Acceptance Criteria

A payment:
- cannot be submitted without valid amount
- cannot bypass authentication
- cannot target an unauthorized project
- starts as PENDING
- only approved payment affects approved totals

An approval:
- requires authorization
- cannot approve the actor's own transaction
- changes status atomically
- records approver and timestamp
- creates an audit event

A rejected transaction:
- remains historical
- does not affect approved totals

## 10. Future Features

Potential future additions:
- CSV export
- monthly reporting
- notifications
- recurring project expenses
- richer analytics
- approval comments
- budget alerts
- configurable currencies
