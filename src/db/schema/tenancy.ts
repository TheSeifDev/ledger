import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth.ts";
import { PROJECT_STATUSES } from "../../../lib/validations/project.ts";

export const roleEnum = pgEnum("role", ["OWNER", "HEAD", "MEMBER"]);

export type Role = (typeof roleEnum.enumValues)[number];

/**
 * Project lifecycle. The value list is owned by lib/validations/project.ts
 * so validation and the schema cannot drift. Financial transaction statuses
 * (PENDING / APPROVED / REJECTED) belong to a later phase's transaction
 * model — do not reuse this enum for them.
 */
export const projectStatusEnum = pgEnum("project_status", PROJECT_STATUSES);

export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("organization_slug_unique").on(table.slug)],
);

export const organizationMember = pgTable(
  "organization_member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("MEMBER"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_member_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_member_user_id_idx").on(table.userId),
  ],
);

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    creatorId: text("creator_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    // Exact money in integer minor units (750.00 EGP → 75000). Never float.
    budgetMinorUnits: bigint("budget_minor_units", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    status: projectStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("project_org_slug_unique").on(table.organizationId, table.slug),
    index("project_organization_id_idx").on(table.organizationId),
    index("project_creator_id_idx").on(table.creatorId),
  ],
);

export const projectMember = pgTable(
  "project_member",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("project_member_project_user_unique").on(
      table.projectId,
      table.userId,
    ),
    index("project_member_user_id_idx").on(table.userId),
  ],
);