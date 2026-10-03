import "server-only";

import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { AuthorizationError } from "@/server/guards/auth";
import { can, Permission } from "@/lib/permissions";
import {
  findOrganizationMembership,
  findOrganizationMembershipsForUser,
  findProjectsBySlugInOrganizations,
  findProjectMembership,
} from "@/server/repositories/tenancy";
import { decodeTransactionCursor } from "@/lib/finance/transactions";
import { findTransactionById } from "@/server/repositories/transactions";
import {
  transitionTransactionIfPending,
  listPendingTransactions,
} from "@/server/repositories/approvals";
import { insertAuditEvent } from "@/server/repositories/audits";

/**
 * Phase 7 approval/rejection orchestration.
 *
 * Reviewer permission: only OWNER/HEAD hold project.manage (Phase 2 role
 * model: heads review and approve eligible transactions; owners retain
 * full control; members may not review). No new roles were introduced.
 *
 * Invariants enforced here:
 *   - PENDING-only transitions (enforced by the conditional UPDATE itself
 *     inside the DB transaction — not by a separate pre-check)
 *   - the submitter can never decide their own transaction
 *   - the state change and its audit event commit atomically or not at all
 *   - terminal states are immutable: APPROVED/REJECTED rows can't revert
 *
 * Error semantics: unknown or out-of-scope transactions raise NOT_FOUND so
 * callers cannot probe for their existence across tenancy boundaries.
 */

export class DecisionConflictError extends Error {
  constructor(
    message: string,
    public readonly code: string = "DECISION_CONFLICT",
  ) {
    super(message);
    this.name = "DecisionConflictError";
  }
}

async function requireReviewableTransaction(actorUserId: string, transactionId: string) {
  const row = await findTransactionById(transactionId);
  if (!row) {
    throw new AuthorizationError("Transaction not found", "NOT_FOUND");
  }

  const membership = await findOrganizationMembership(actorUserId, row.organizationId);
  if (!membership || !can({ role: membership.role }, Permission.PROJECT_MANAGE)) {
    // Only OWNER/HEAD reach a review decision; hide unreadable transactions.
    throw new AuthorizationError("Transaction not found", "NOT_FOUND");
  }

  const projectMembership = await findProjectMembership(actorUserId, row.projectId);
  if (!projectMembership) {
    throw new AuthorizationError("Transaction not found", "NOT_FOUND");
  }

  // Self-decision is forbidden in both directions.
  if (row.createdByUserId === actorUserId) {
    throw new AuthorizationError(
      "Submitters cannot approve or reject their own transaction",
      "SELF_DECISION_FORBIDDEN",
    );
  }

  return { transaction: row, membership, projectMembership };
}

export async function approveTransaction(actorUserId: string, transactionId: string) {
  return decide(actorUserId, transactionId, "APPROVED");
}

export async function rejectTransaction(actorUserId: string, transactionId: string) {
  return decide(actorUserId, transactionId, "REJECTED");
}

async function decide(
  actorUserId: string,
  transactionId: string,
  decision: "APPROVED" | "REJECTED",
) {
  const access = await requireReviewableTransaction(actorUserId, transactionId);

  // Fast fail before opening a transaction if the state is terminal.
  if (access.transaction.status !== "PENDING") {
    throw new DecisionConflictError(
      `This transaction is already ${access.transaction.status.toLowerCase()}.`,
    );
  }

  return db.transaction(async (tx) => {
    const updated = await transitionTransactionIfPending(
      {
        transactionId: access.transaction.id,
        decision,
        reviewerId: actorUserId,
      },
      tx,
    );
    if (!updated) {
      // A concurrent reviewer won, or the row changed first.
      throw new DecisionConflictError(
        "This transaction was decided by another reviewer.",
      );
    }

    const audit = await insertAuditEvent(
      {
        id: randomUUID(),
        organizationId: updated.organizationId,
        projectId: updated.projectId,
        actorUserId,
        entityType: "transaction",
        entityId: updated.id,
        action:
          decision === "APPROVED" ? "TRANSACTION_APPROVED" : "TRANSACTION_REJECTED",
        metadata: {
          type: updated.type,
          // Reference-only context; amounts are never recomputed here.
          amountMinorUnits: updated.amountMinorUnits.toString(),
        },
      },
      tx,
    );
    if (!audit) throw new Error("Audit insert returned no row");

    return { transaction: updated, auditId: audit.id };
  });
}

export async function listPendingReviews(
  actorUserId: string,
  projectSlug: string,
  cursor?: string,
  limit?: number,
) {
  const memberships = await findOrganizationMembershipsForUser(actorUserId);
  const organizationIds = memberships.map((m) => m.organizationId);

  const candidates = await findProjectsBySlugInOrganizations(organizationIds, projectSlug);
  const candidate = candidates.find((c) => {
    const membership = memberships.find((m) => m.organizationId === c.organizationId);
    return membership && can({ role: membership.role }, Permission.PROJECT_MANAGE);
  });
  if (!candidate) {
    throw new AuthorizationError("Project not found", "PROJECT_NOT_FOUND");
  }
  const projectMembership = await findProjectMembership(actorUserId, candidate.id);
  if (!projectMembership) {
    throw new AuthorizationError("Project not found", "PROJECT_NOT_FOUND");
  }

  let cursorCreatedAt: Date | null = null;
  let cursorId: string | null = null;
  if (cursor) {
    const decoded = decodeTransactionCursor(cursor);
    if (decoded) {
      cursorCreatedAt = decoded.createdAt;
      cursorId = decoded.id;
    }
  }

  return listPendingTransactions(
    candidate.id,
    Math.min(limit ?? 25, 50),
    cursorCreatedAt,
    cursorId,
  );
}
