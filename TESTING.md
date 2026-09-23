# Testing Strategy

## Objective

Testing prioritizes financial correctness and authorization over superficial UI coverage.

## Test Pyramid

### Unit Tests

Highest priority.

Test:
- financial calculations
- transaction state rules
- permission rules
- validation
- edge cases

### Integration Tests

Test:
- database repositories
- transaction approval
- audit logging
- auth + authorization boundaries

### End-to-End Tests

Test critical user journeys:

```text
Login
→ Open project
→ Submit payment
→ Review pending
→ Approve
→ Verify updated balance
```

## Financial Test Cases

### Payment

- positive amount accepted
- zero rejected
- negative rejected
- approved payment increases approved payments
- pending payment does not affect approved totals
- rejected payment does not affect approved totals

### Withdrawal

- approved withdrawal reduces net collected funds
- pending withdrawal does not affect approved totals
- rejected withdrawal does not affect approved totals

### Member Balance

Given:

```text
Target = 50000
Approved payments = 35000
Approved withdrawals = 0
```

Expected:

```text
Net contribution = 35000
Balance = -15000
```

The implementation should define the UI meaning of negative/positive balance clearly.

## Approval Tests

Must test:

- authorized owner can approve
- authorized head can approve
- member cannot approve
- transaction creator cannot approve own transaction
- already approved transaction cannot be approved again
- rejected transaction cannot be approved without an explicit correction workflow
- approval creates audit event
- transaction update + audit event are atomic

## Authorization Tests

For every protected operation test:

- unauthenticated user
- authenticated unauthorized user
- authorized member
- authorized head
- authorized owner

Also test cross-project access.

## Evidence Tests

Test:
- allowed file types
- disallowed MIME types
- size limit
- generated object key
- unauthorized access to private evidence
- failed upload does not create broken financial state

## Database Tests

Use a dedicated test database/environment.

Never run destructive test migrations against production.

## E2E Critical Path

At minimum:

```text
member submits payment
→ transaction is PENDING
→ head opens pending queue
→ head approves
→ project totals update
→ member balance updates
→ audit record exists
```

## Regression

Every discovered financial/security bug should get a regression test.

## Definition of Test Completion

A financial feature is not complete until:
- business rules have unit coverage,
- authorization is covered,
- important DB transitions are integration tested,
- critical UX flow is covered by E2E where practical.
