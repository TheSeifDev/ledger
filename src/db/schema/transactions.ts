import {
  bigint,
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { user } from "./auth.ts";
import { organization, project } from "./tenancy.ts";
import {
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  TRANSACTION_NOTES_MAX,
} from "../../../lib/validations/transactions.ts";

/**
 * Unified authoritative transaction ledger (Phase 4).
 *
 * One table holds PAYMENT and WITHDRAWAL rows — the type is a column, not
 * separate tables. Status starts at PENDING; approval/rejection workflow
 * lands in a later phase, so the approval metadata columns are nullable
 * foundation fields only.
 *
 * Tenancy invariants enforced at the database:
 *   - FK organization_id → organization.id
 *   - composite FK (organization_id, project_id) →
 *     project(organization_id, id), so a row can never reference a project
 *     from a different organization
 *   - FK created_by_user_id → user.id
 *   - amount_minor_units > 0, notes length <= 255, enum-bounded type/status
 *   - idempotency_key unique per (organization, actor)
 */
export const transactionTypeEnum = pgEnum("transaction_type", TRANSACTION_TYPES);
export const transactionStatusEnum = pgEnum(
  "transaction_status",
  TRANSACTION_STATUSES,
);

export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type TransactionStatus = (typeof transactionStatusEnum.enumValues)[number];

export const transaction = pgTable(
  "transaction",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    type: transactionTypeEnum("type").notNull(),
    // Exact integer minor units (750.00 EGP → 75000). Never float.
    amountMinorUnits: bigint("amount_minor_units", { mode: "bigint" }).notNull(),
    paidTo: text("paid_to"),
    notes: text("notes"),
    // Phase 9 stores the object key once evidence uploads exist.
    evidenceKey: text("evidence_key"),
    status: transactionStatusEnum("status").notNull().default("PENDING"),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedByUserId: text("rejected_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Composite FK: the project's organization must equal the transaction's
    // organization — cross-organization project references are impossible.
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [project.organizationId, project.id],
      name: "transaction_org_project_fk",
    }).onDelete("cascade"),
    uniqueIndex("transaction_org_actor_idem_unique").on(
      table.organizationId,
      table.createdByUserId,
      table.idempotencyKey,
    ),
    index("transaction_project_created_idx").on(table.projectId, table.createdAt),
    index("transaction_organization_id_idx").on(table.organizationId),
    index("transaction_created_by_user_id_idx").on(table.createdByUserId),
    check(
      "transaction_amount_positive",
      sql`${table.amountMinorUnits} > 0`,
    ),
    check(
      "transaction_notes_max_length",
      sql`${table.notes} is null or char_length(${table.notes}) <= ${sql.raw(String(TRANSACTION_NOTES_MAX))}`,
    ),
  ],
);
