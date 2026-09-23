# TESTING

```text
┌──────────────────────────────────────────────┐
│               PHANTOMS FINANCE               │
├──────────────────────────────────────────────┤
│                                              │
│   TESTING                                    │
│   Testing Strategy                           │
│                                              │
│   Pyramid · Financial Cases · Approval       │
│   Authorization · Evidence · E2E             │
│                                              │
└──────────────────────────────────────────────┘
```

## 1. Objective

Testing prioritizes financial correctness and authorization over superficial UI coverage.

## 2. Test Pyramid

```text
        ▲
       /E2E\        critical user journeys
      /─────\
     /Integra\     repositories · approvals · audit · authZ
    /─────────\
   /   Unit    \   calculations · state rules · permissions
  /─────────────\
        ▼
```

### Unit Tests — Highest Priority

Test:

```text
├── financial calculations
├── transaction state rules
├── permission rules
├── validation
└── edge cases
```

### Integration Tests

Test:

```text
├── database repositories
├── transaction approval
├── audit logging
└── auth + authorization boundaries
```

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

## 3. Financial Test Cases

### Payment

```text
├── positive amount accepted
├── zero rejected
├── negative rejected
├── approved payment increases approved payments
├── pending payment does not affect approved totals
└── rejected payment does not affect approved totals
```

### Withdrawal

```text
├── approved withdrawal reduces net collected funds
├── pending withdrawal does not affect approved totals
└── rejected withdrawal does not affect approved totals
```

### Member Balance

Given:

```text
Target             = 50000
Approved payments  = 35000
Approved withdrawals = 0
```

Expected:

```text
Net contribution = 35000
Balance          = -15000
```

The implementation should define the UI meaning of negative/positive balance clearly.

## 4. Approval Tests

Must test:

```text
├── authorized owner can approve
├── authorized head can approve
├── member cannot approve
├── transaction creator cannot approve own transaction
├── already approved transaction cannot be approved again
├── rejected transaction cannot be approved without
│   an explicit correction workflow
├── approval creates audit event
└── transaction update + audit event are atomic
```

## 5. Authorization Tests

For every protected operation test:

```text
├── unauthenticated user
├── authenticated unauthorized user
├── authorized member
├── authorized head
└── authorized owner
```

Also test cross-project access.

### Tenant Isolation Tests

```text
├── user of org A cannot read org B projects
├── user of org A cannot write org B transactions
├── unscoped queries are rejected in the domain layer
└── cross-org evidence access fails
```

Even with a single organization today, the boundary is tested. It must fail closed.

## 6. Evidence Tests

Test:

```text
├── allowed file types
├── disallowed MIME types
├── size limit
├── generated object key
├── unauthorized access to private evidence
└── failed upload does not create broken financial state
```

## 7. Database Tests

Use a dedicated test database/environment.

Never run destructive test migrations against production.

## 8. E2E Critical Path

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

## 9. Regression

Every discovered financial/security bug gets a regression test.

```text
bug found
   ↓
fix implemented
   ↓
regression test added
   ↓
never silently reintroduced
```

## 10. Definition of Test Completion

A financial feature is not complete until:

```text
├── business rules have unit coverage
├── authorization is covered
├── tenant isolation is covered
├── important DB transitions are integration tested
└── critical UX flow is covered by E2E where practical
```
