# Design System

## Product Character

Ledger should feel:

- professional
- precise
- modern
- trustworthy
- calm
- technical

Avoid:
- excessive gradients
- noisy dashboards
- decorative financial charts without meaning
- excessive glassmorphism
- fake banking aesthetics
- unnecessary animations

## Visual Direction

Use a modern SaaS language inspired by high-quality productivity tools.

Prioritize:
- strong typography
- clear spacing
- restrained surfaces
- subtle borders
- meaningful color semantics
- dense but readable data presentation

## Color Semantics

Colors communicate state, not decoration.

- Primary: brand/action
- Success: approved/positive financial state
- Warning: pending/review
- Destructive: rejected/danger
- Neutral: informational/disabled

Never rely on color alone. Pair state colors with text/iconography.

## Typography

Use a clean sans-serif system.

Recommended hierarchy:

```text
Display
Page title
Section title
Card title
Body
Secondary
Caption
```

Numbers in financial cards should have strong typographic emphasis.

## Spacing

Use a consistent spacing scale based on Tailwind tokens.

Avoid arbitrary one-off spacing unless visually justified.

## Components

Core UI components:

- Button
- Input
- Textarea
- Select
- Dialog
- Sheet
- Card
- Badge
- Table
- Tabs
- Dropdown
- Toast
- Skeleton
- Empty State
- Alert

Finance components:

- SummaryCard
- ProjectCard
- FundingProgress
- TransactionTable
- TransactionCard
- TransactionStatus
- ApprovalCard
- MemberBalance
- EvidencePreview

## Financial UI

Always distinguish:

```text
PENDING
APPROVED
REJECTED
```

Display:
- amount
- transaction type
- actor
- recipient
- date
- status

Approved amounts should be visually distinct from pending amounts.

## Forms

Every finance form should:
- clearly display the current project
- show currency
- validate amount
- prevent accidental duplicate submission
- show submission state
- show server errors safely
- support keyboard navigation

## Responsive Design

Desktop:
- data-dense tables
- dashboard grids

Mobile:
- cards instead of wide tables when necessary
- stacked transaction metadata
- full-width actions
- touch-friendly controls

## Accessibility

Target WCAG 2.2 AA where practical.

Requirements:
- keyboard accessible
- visible focus states
- semantic HTML
- sufficient contrast
- labels for inputs
- no color-only status communication
- accessible dialogs and menus

## Motion

Motion should communicate:
- loading
- state transition
- navigation
- confirmation

Avoid animation that delays financial actions.

## Icons

Use Lucide consistently.

Do not mix multiple icon libraries without a strong reason.
