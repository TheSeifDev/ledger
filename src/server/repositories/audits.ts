import "server-only";

import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";

/**
 * Audit data access. Inserts only — audit events are append-only and are
 * always written inside the same DB transaction as the state change they
 * record (see src/server/services/approvals.ts).
 */

/** Handles both the root database object and an in-flight transaction. */
export type DbExecutor =
  | NodePgDatabase<typeof schema>
  | Parameters<
      Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]
    >[0];

export interface AuditEventInput {
  id: string;
  organizationId: string;
  projectId: string | null;
  actorUserId: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export async function insertAuditEvent(
  input: AuditEventInput,
  executor: DbExecutor = db,
) {
  const [row] = await executor
    .insert(auditLog)
    .values({
      id: input.id,
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      metadata: input.metadata ?? null,
    })
    .returning();
  return row ?? null;
}

