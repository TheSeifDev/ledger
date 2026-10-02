import "server-only";

import { db } from "@/db";
import { and, desc, eq, lt, or, sql, type SQL } from "drizzle-orm";
import { transaction, user } from "@/db/schema";
import type { TransactionStatus, TransactionType } from "@/db/schema/transactions";
import {
  decodeTransactionCursor,
  encodeTransactionCursor,
} from "@/lib/finance/transactions";

/**
 * Phase 4 transaction data access.
 *
 * All queries are organization/project-scoped by the service layer; nothing
 * here self-authorizes and nothing returns unbounded result sets.
 * Pagination is keyset-based over (created_at, id) descending so pages are
 * stable while rows are appended.
 */

export type TransactionRow = typeof transaction.$inferSelect;

export interface CreateTransactionRow {
  id: string;
  organizationId: string;
  projectId: string;
  createdByUserId: string;
  type: TransactionType;
  amountMinorUnits: bigint;
  paidTo: string | null;
  notes: string | null;
  status: TransactionStatus;
  idempotencyKey: string;
}

export async function createTransaction(input: CreateTransactionRow) {
  const [created] = await db.insert(transaction).values(input).returning();
  return created ?? null;
}

export async function findTransactionById(id: string) {
  return db.query.transaction.findFirst({
    where: eq(transaction.id, id),
  });
}

export async function findTransactionByIdempotencyKey(
  organizationId: string,
  createdByUserId: string,
  idempotencyKey: string,
) {
  return db.query.transaction.findFirst({
    where: and(
      eq(transaction.organizationId, organizationId),
      eq(transaction.createdByUserId, createdByUserId),
      eq(transaction.idempotencyKey, idempotencyKey),
    ),
  });
}

export interface ListTransactionsFilter {
  projectId: string;
  type?: TransactionType;
  status?: TransactionStatus;
  createdByUserId?: string;
  cursor?: string; // opaque keyset cursor: base64url("createdAtIso|id")
  limit: number; // already bounded by validation (≤ 50)
}

export interface ListTransactionsPage {
  rows: (TransactionRow & { creatorName: string; creatorEmail: string })[];
  nextCursor: string | null;
}

export { encodeTransactionCursor, decodeTransactionCursor };

/**
 * Bounded page of transactions for one project, newest first.
 * Fetches limit+1 rows to detect a following page. The cursor comparison is
 * a lexicographic-analogue tuple comparison on (created_at, id).
 */
export async function listTransactions(
  filter: ListTransactionsFilter,
): Promise<ListTransactionsPage> {
  const conditions: SQL[] = [eq(transaction.projectId, filter.projectId)];
  if (filter.type) conditions.push(eq(transaction.type, filter.type));
  if (filter.status) conditions.push(eq(transaction.status, filter.status));
  if (filter.createdByUserId) {
    conditions.push(eq(transaction.createdByUserId, filter.createdByUserId));
  }

  const decoded = filter.cursor ? decodeTransactionCursor(filter.cursor) : null;
  if (decoded) {
    conditions.push(
      or(
        lt(transaction.createdAt, decoded.createdAt),
        and(
          eq(transaction.createdAt, decoded.createdAt),
          lt(transaction.id, decoded.id),
        ),
      )!,
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
    .limit(filter.limit + 1);

  const hasMore = rows.length > filter.limit;
  const page = hasMore ? rows.slice(0, filter.limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last
    ? encodeTransactionCursor(last.transaction.createdAt, last.transaction.id)
    : null;

  return {
    rows: page.map((r) => ({
      ...r.transaction,
      creatorName: r.creatorName,
      creatorEmail: r.creatorEmail,
    })),
    nextCursor,
  };
}

export async function countTransactionsForProject(projectId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transaction)
    .where(eq(transaction.projectId, projectId));
  return row?.count ?? 0;
}
