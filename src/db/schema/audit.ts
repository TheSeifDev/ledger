import { jsonb, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth.ts";
import { organization } from "./tenancy.ts";

/**
 * Audit foundation, introduced with Phase 7 (the first phase whose
 * invariants REQUIRE audit atomicity: approval/rejection commits must be
 * atomic with a ledger of who decided what).
 *
 * Every event is organization-resolvable. Rows are append-only and only
 * written from server transactions alongside the state change they record
 * (the service layer wraps both in one DB transaction).
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Optional project context for project-scoped entities.
    projectId: text("project_id"),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    // e.g. "transaction" | "payment" | ...
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    // e.g. "TRANSACTION_APPROVED" | "TRANSACTION_REJECTED"
    action: text("action").notNull(),
    // Optional structured context (never secrets).
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_log_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
  ],
);
