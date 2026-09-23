# DESIGN SYSTEM

```text
┌──────────────────────────────────────────────┐
│               PHANTOMS FINANCE               │
├──────────────────────────────────────────────┤
│                                              │
│   DESIGN SYSTEM                              │
│   UI/UX Rules                                │
│                                              │
│   Character · Color · Typography             │
│   Components · Financial UI · A11y           │
│                                              │
└──────────────────────────────────────────────┘
```

## 1. Product Character

Ledger should feel:

```text
professional
    ↓
precise
    ↓
modern · trustworthy
    ↓
calm · technical
```

Avoid:

```text
├── excessive gradients
├── noisy dashboards
├── decorative financial charts without meaning
├── excessive glassmorphism
├── fake banking aesthetics
└── unnecessary animations
```

## 2. Visual Direction

Use a modern SaaS language inspired by high-quality productivity tools.

Prioritize:

```text
├── strong typography
├── clear spacing
├── restrained surfaces
├── subtle borders
├── meaningful color semantics
└── dense but readable data presentation
```

## 3. Color Semantics

Colors communicate state, not decoration.

```text
Primary     → brand / action
Success     → approved / positive financial state
Warning     → pending / review
Destructive → rejected / danger
Neutral     → informational / disabled
```

Never rely on color alone. Pair state colors with text/iconography.

## 4. Typography

Use a clean sans-serif system.

Hierarchy:

```text
Display
  ↓
Page title
  ↓
Section title
  ↓
Card title
  ↓
Body
  ↓
Secondary
  ↓
Caption
```

Numbers in financial cards have strong typographic emphasis.

## 5. Spacing

Use a consistent spacing scale based on Tailwind tokens.

Avoid arbitrary one-off spacing unless visually justified.

## 6. Components

Core UI components:

```text
├── Button
├── Input
├── Textarea
├── Select
├── Dialog
├── Sheet
├── Card
├── Badge
├── Table
├── Tabs
├── Dropdown
├── Toast
├── Skeleton
├── Empty State
└── Alert
```

Finance components:

```text
├── SummaryCard
├── ProjectCard
├── FundingProgress
├── TransactionTable
├── TransactionCard
├── TransactionStatus
├── ApprovalCard
├── MemberBalance
└── EvidencePreview
```

## 7. Financial UI

Always distinguish:

```text
PENDING
    ↓
APPROVED
    ↓
REJECTED
```

Display:

```text
├── amount
├── transaction type
├── actor
├── recipient
├── date
└── status
```

Approved amounts are visually distinct from pending amounts.

## 8. Forms

Every finance form should:

```text
├── clearly display the current project
├── show currency
├── validate amount
├── prevent accidental duplicate submission
├── show submission state
├── show server errors safely
└── support keyboard navigation
```

## 9. Responsive Design

Desktop:

```text
├── data-dense tables
└── dashboard grids
```

Mobile:

```text
├── cards instead of wide tables when necessary
├── stacked transaction metadata
├── full-width actions
└── touch-friendly controls
```

## 10. Accessibility

Target WCAG 2.2 AA where practical.

Requirements:

```text
├── keyboard accessible
├── visible focus states
├── semantic HTML
├── sufficient contrast
├── labels for inputs
├── no color-only status communication
└── accessible dialogs and menus
```

## 11. Motion

Motion communicates:

```text
├── loading
├── state transition
├── navigation
└── confirmation
```

Avoid animation that delays financial actions.

## 12. Icons

Use Lucide consistently.

Do not mix multiple icon libraries without a strong reason.
