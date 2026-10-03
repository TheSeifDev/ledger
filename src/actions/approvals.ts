"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser, AuthorizationError } from "@/server/guards/auth";
import * as approvalsService from "@/server/services/approvals";
import { DecisionConflictError } from "@/server/services/approvals";

/**
 * Phase 7 review boundary. The client supplies only a transaction id
 * (bound into the form by an authorized page render) — no status, no
 * reviewer identity, no timestamps. All of those are server-owned.
 */

export type DecisionActionState = {
  ok: boolean;
  formError?: string;
};

function toFailure(error: unknown): DecisionActionState {
  if (error instanceof AuthorizationError) {
    if (error.code === "SELF_DECISION_FORBIDDEN") {
      return { ok: false, formError: "You cannot approve or reject your own transaction." };
    }
    return { ok: false, formError: "Transaction not found." };
  }
  if (error instanceof DecisionConflictError) {
    return { ok: false, formError: error.message };
  }
  return { ok: false, formError: "The decision could not be recorded. Please try again." };
}

function validateTransactionId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function approveTransactionAction(
  projectSlug: string,
  transactionId: string,
  prev: DecisionActionState | undefined,
  _formData: FormData,
): Promise<DecisionActionState> {
  void _formData;
  const { user } = await requireAuthenticatedUser();
  void prev;
  if (!validateTransactionId(transactionId)) {
    return { ok: false, formError: "Invalid transaction." };
  }

  try {
    await approvalsService.approveTransaction(user.id, transactionId);
    revalidatePath(`/projects/${projectSlug}`);
    return { ok: true };
  } catch (error) {
    return toFailure(error);
  }
}

export async function rejectTransactionAction(
  projectSlug: string,
  transactionId: string,
  prev: DecisionActionState | undefined,
  _formData: FormData,
): Promise<DecisionActionState> {
  void _formData;
  const { user } = await requireAuthenticatedUser();
  void prev;
  if (!validateTransactionId(transactionId)) {
    return { ok: false, formError: "Invalid transaction." };
  }

  try {
    await approvalsService.rejectTransaction(user.id, transactionId);
    revalidatePath(`/projects/${projectSlug}`);
    return { ok: true };
  } catch (error) {
    return toFailure(error);
  }
}
