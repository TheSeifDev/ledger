import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { transaction, user } from "@/db/schema";
import type { TransactionStatus } from "@/db/schema/transactions";
import type { DbExecutor } from "./audits";

/**
 * Phase 7 decision data access.
 *
 * State transitions are atomic: a single conditional UPDATE gates on
 * status='PENDING' inside a caller-provided DB transaction, and the required
 * audit event is inserted in the same transaction — both commit or neither
 * does.
 */

export interface DecisionInput {
  transactionId: string;
  decision: "APPROVED" | "REJECTED";
  reviewerId: string;
}

/**
 * Single-statement atomic gate: `WHERE status = 'PENDING'` means exactly
 * one of two concurrent reviewers can win; the loser affects zero rows.
 * The reviewer metadata is set by the server only.
 */
export async function transitionTransactionIfPending(
  input: DecisionInput,
  executor: DbExecutor = db,
) {
  const decisionAt = new Date();
  const [updated] = await executor
    .update(transaction)
    .set(
      input.decision === "APPROVED"
        ? {
            status: "APPROVED",
            approvedByUserId: input.reviewerId,
            approvedAt: decisionAt,
            updatedAt: decisionAt,
          }
        : {
            status: "REJECTED",
            rejectedByUserId: input.reviewerId,
            rejectedAt: decisionAt,
            updatedAt: decisionAt,
          },
    )
    .where(and(eq(transaction.id, input.transactionId), eq(transaction.status, "PENDING")))
    .returning();
  return updated ?? null;
}

export async function listPendingTransactions(
  projectId: string,
  limit: number,
  cursorCreatedAt: Date | null,
  cursorId: string | null,
) {
  const conditions = [
    eq(transaction.projectId, projectId),
    eq(transaction.status, "PENDING" as TransactionStatus),
  ];
  if (cursorCreatedAt && cursorId) {
    conditions.push(
      // keyset: strictly older than the cursor tuple (created_at, id) desc
      sql`(${transaction.createdAt}, ${transaction.id}) < (${cursorCreatedAt}, ${cursorId})`,
    );
  }
  const rows = await db
    .select({
      transaction,
      creatorName: user.name,
      creatorEmail: user.email,
    })
    .from(transaction)
    .innerJoin(user, eq(transaction.createdByUserId, user.id))
    .where(and(...conditions))
    .orderBy(desc(transaction.createdAt), desc(transaction.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: hasMore && last
      ? { createdAt: last.transaction.createdAt, id: last.transaction.id }
      : null,
  };
}
