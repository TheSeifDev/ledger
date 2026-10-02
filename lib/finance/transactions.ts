import {
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  type TransactionStatus,
  type TransactionType,
} from "../validations/transactions.ts";

export { TRANSACTION_TYPES, TRANSACTION_STATUSES };
export type { TransactionStatus, TransactionType };

/**
 * Keyset pagination cursor for the transaction ledger: opaque
 * base64url("createdAtIso|id"), compared as a strict tuple
 * (created_at, id) in the repository. Pages stay stable while rows are
 * appended.
 */
export function encodeTransactionCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString(
    "base64url",
  );
}

export function decodeTransactionCursor(
  cursor: string,
): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const sep = raw.lastIndexOf("|");
    if (sep <= 0) return null;
    const createdAt = new Date(raw.slice(0, sep));
    const id = raw.slice(sep + 1);
    if (Number.isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/**
 * Canonical payload an idempotency key is claimed to represent.
 */
export interface IdempotentPayload {
  type: TransactionType;
  amountMinorUnits: bigint;
  paidTo: string | null;
  notes: string | null;
  organizationId: string;
  projectId: string;
  createdByUserId: string;
}

/**
 * Phase 4 idempotency rule (server-side, backed by a DB unique index):
 *
 *   same organization + same actor + same idempotency key AND the same
 *   logical payload  → return the existing transaction (safe retry)
 *   same key but a different payload
 *                    → reject as a conflict (never silently merge)
 *
 * This pure comparison is shared by the service layer and the tests.
 */
export function idempotentPayloadMatches(
  existing: IdempotentPayload,
  incoming: IdempotentPayload,
): boolean {
  return (
    existing.type === incoming.type &&
    existing.amountMinorUnits === incoming.amountMinorUnits &&
    existing.paidTo === incoming.paidTo &&
    existing.notes === incoming.notes &&
    existing.organizationId === incoming.organizationId &&
    existing.projectId === incoming.projectId &&
    existing.createdByUserId === incoming.createdByUserId
  );
}
