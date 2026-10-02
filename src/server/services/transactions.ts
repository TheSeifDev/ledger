import "server-only";

import { randomUUID } from "node:crypto";

import { AuthorizationError } from "@/server/guards/auth";
import { can, Permission } from "@/lib/permissions";
import { idempotentPayloadMatches } from "@/lib/finance/transactions";
import {
  findOrganizationMembership,
  findOrganizationMembershipsForUser,
  findProjectsBySlugInOrganizations,
  findProjectMembership,
} from "@/server/repositories/tenancy";
import {
  createTransaction as repoCreateTransaction,
  findTransactionById,
  findTransactionByIdempotencyKey,
  listTransactions as repoListTransactions,
  type ListTransactionsPage,
} from "@/server/repositories/transactions";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  type ListTransactionsQuery,
} from "@/lib/validations/transactions";
import {
  paymentSubmissionSchema,
  type PaymentSubmissionInput,
} from "@/lib/validations/payments";
import {
  withdrawalSubmissionSchema,
  type WithdrawalSubmissionInput,
} from "@/lib/validations/withdrawals";
import { toMinorUnits } from "@/lib/validations/project";
import type { TransactionStatus, TransactionType } from "@/db/schema/transactions";

/**
 * Phase 4 transaction orchestration.
 *
 * The actor id always comes from the server session (action layer); the
 * service never trusts client-supplied organization/project/creator values.
 * Transactions are always created as PENDING — approval/rejection is a
 * later phase, so no transition API exists here.
 */

export class TransactionConflictError extends Error {
  constructor(
    message: string,
    public readonly code: string = "CONFLICT",
  ) {
    super(message);
    this.name = "TransactionConflictError";
  }
}

/** Resolve the project within the actor's organizations (slug is per-org). */
async function resolveProjectInActorScope(actorUserId: string, slug: string) {
  const memberships = await findOrganizationMembershipsForUser(actorUserId);
  const organizationIds = memberships.map((m) => m.organizationId);
  const candidates = await findProjectsBySlugInOrganizations(organizationIds, slug);
  for (const candidate of candidates) {
    const membership = memberships.find(
      (m) => m.organizationId === candidate.organizationId,
    );
    if (!membership) continue;
    return { project: candidate, membership };
  }
  return null;
}

async function requireTransactionActorAccess(
  actorUserId: string,
  transactionId: string,
  permission: Permission,
) {
  const row = await findTransactionById(transactionId);
  if (!row) {
    // Do not leak existence across tenancy boundaries.
    throw new AuthorizationError("Transaction not found", "NOT_FOUND");
  }

  const membership = await findOrganizationMembership(actorUserId, row.organizationId);
  if (!membership || !can({ role: membership.role }, permission)) {
    throw new AuthorizationError("Transaction not found", "NOT_FOUND");
  }

  const projectMembership = await findProjectMembership(actorUserId, row.projectId);
  if (!projectMembership) {
    throw new AuthorizationError("Transaction not found", "NOT_FOUND");
  }

  return { row, membership, projectMembership };
}

export interface PendingTransactionInput {
  type: TransactionType;
  amount: string;
  paidTo?: string;
  notes?: string;
  idempotencyKey: string;
}

/**
 * Create a PENDING transaction. The caller (a Phase 5/6 submission
 * service) supplies the type as a server-controlled fact — it never
 * arrives inside the validated client payload.
 *
 * Idempotency is server/database enforced:
 *
 *   - same (organization, actor, key) + identical payload → the existing
 *     transaction is returned (safe retry; no duplicate row)
 *   - same key with a different payload → TransactionConflictError
 *   - concurrent retries cannot double-insert: the unique index
 *     transaction_org_actor_idem_unique rejects the second insert, and the
 *     loser re-reads and returns the winner's row (or conflicts)
 */
async function createPending(
  actorUserId: string,
  projectSlug: string,
  input: PendingTransactionInput,
) {
  const parsed = createTransactionSchema.parse(input);

  const scope = await resolveProjectInActorScope(actorUserId, projectSlug);
  if (!scope) {
    throw new AuthorizationError("Project not found", "PROJECT_NOT_FOUND");
  }

  // Submission requires project membership. (Distinct PAYMENT/WITHDRAWAL
  // submission permissions arrive with the role model of their phases.)
  const projectMembership = await findProjectMembership(
    actorUserId,
    scope.project.id,
  );
  if (!projectMembership) {
    throw new AuthorizationError("Project not found", "PROJECT_NOT_FOUND");
  }

  const organizationId = scope.project.organizationId;
  const payload = {
    type: parsed.type as TransactionType,
    amountMinorUnits: toMinorUnits(parsed.amount),
    paidTo: parsed.paidTo ?? null,
    notes: parsed.notes ?? null,
    organizationId,
    projectId: scope.project.id,
    createdByUserId: actorUserId,
  };

  const existing = await findTransactionByIdempotencyKey(
    organizationId,
    actorUserId,
    parsed.idempotencyKey,
  );
  if (existing) {
    if (idempotentPayloadMatches(toPayloadShape(existing), payload)) {
      return { transaction: existing, replayed: true };
    }
    throw new TransactionConflictError(
      "This idempotency key was already used with a different payload.",
      "IDEMPOTENCY_CONFLICT",
    );
  }

  try {
    const created = await repoCreateTransaction({
      id: randomUUID(),
      ...payload,
      status: "PENDING",
      idempotencyKey: parsed.idempotencyKey,
    });
    if (!created) throw new Error("Transaction insert returned no row");
    return { transaction: created, replayed: false };
  } catch (error) {
    if (isIdempotencyViolation(error)) {
      // A concurrent request won the insert. Re-read and reconcile.
      const winner = await findTransactionByIdempotencyKey(
        organizationId,
        actorUserId,
        parsed.idempotencyKey,
      );
      if (winner) {
        if (idempotentPayloadMatches(toPayloadShape(winner), payload)) {
          return { transaction: winner, replayed: true };
        }
        throw new TransactionConflictError(
          "This idempotency key was already used with a different payload.",
          "IDEMPOTENCY_CONFLICT",
        );
      }
    }
    throw error;
  }
}

/**
 * Phase 5: payment submission. Creates exactly one unified transaction
 * with type = PAYMENT and status = PENDING; both are server-fixed facts
 * here — no path accepts them from a client.
 */
export async function submitPayment(
  actorUserId: string,
  projectSlug: string,
  input: PaymentSubmissionInput,
) {
  const parsed = paymentSubmissionSchema.parse(input);
  return createPending(actorUserId, projectSlug, {
    type: "PAYMENT",
    amount: parsed.amount,
    paidTo: parsed.paidTo,
    notes: parsed.notes,
    idempotencyKey: parsed.idempotencyKey,
  });
}

/**
 * Phase 6: withdrawal submission. Creates exactly one unified transaction
 * with type = WITHDRAWAL and status = PENDING; both are server-fixed facts
 * here — no path accepts them from a client. A PENDING withdrawal has no
 * approved financial impact; balances/aggregates change only after the
 * approval phase.
 */
export async function submitWithdrawal(
  actorUserId: string,
  projectSlug: string,
  input: WithdrawalSubmissionInput,
) {
  const parsed = withdrawalSubmissionSchema.parse(input);
  return createPending(actorUserId, projectSlug, {
    type: "WITHDRAWAL",
    amount: parsed.amount,
    paidTo: parsed.paidTo,
    notes: parsed.notes,
    idempotencyKey: parsed.idempotencyKey,
  });
}

export async function getTransaction(
  actorUserId: string,
  transactionId: string,
) {
  const access = await requireTransactionActorAccess(
    actorUserId,
    transactionId,
    Permission.PROJECT_READ,
  );
  return access;
}

export async function listTransactions(
  actorUserId: string,
  projectSlug: string,
  query: ListTransactionsQuery,
): Promise<ListTransactionsPage> {
  const parsed = listTransactionsQuerySchema.parse(query);

  const scope = await resolveProjectInActorScope(actorUserId, projectSlug);
  if (!scope) {
    throw new AuthorizationError("Project not found", "PROJECT_NOT_FOUND");
  }
  if (!can({ role: scope.membership.role }, Permission.PROJECT_READ)) {
    throw new AuthorizationError("Project not found", "PROJECT_NOT_FOUND");
  }
  const projectMembership = await findProjectMembership(
    actorUserId,
    scope.project.id,
  );
  if (!projectMembership) {
    throw new AuthorizationError("Project not found", "PROJECT_NOT_FOUND");
  }

  // A client may only filter by a creator it can see; the creator filter is
  // never used to expand scope — org/project scope is already enforced.
  return repoListTransactions({
    projectId: scope.project.id,
    type: parsed.type as TransactionType | undefined,
    status: parsed.status as TransactionStatus | undefined,
    createdByUserId: parsed.createdByUserId,
    cursor: parsed.cursor,
    limit: parsed.limit,
  });
}

function toPayloadShape(row: {
  type: TransactionType;
  amountMinorUnits: bigint;
  paidTo: string | null;
  notes: string | null;
  organizationId: string;
  projectId: string;
  createdByUserId: string;
}) {
  return {
    type: row.type,
    amountMinorUnits: typeof row.amountMinorUnits === "bigint"
      ? row.amountMinorUnits
      : BigInt(row.amountMinorUnits),
    paidTo: row.paidTo,
    notes: row.notes,
    organizationId: row.organizationId,
    projectId: row.projectId,
    createdByUserId: row.createdByUserId,
  };
}

function isIdempotencyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505" &&
    (error as { constraint?: string }).constraint ===
      "transaction_org_actor_idem_unique"
  );
}
