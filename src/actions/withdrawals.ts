"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser, AuthorizationError } from "@/server/guards/auth";
import {
  withdrawalSubmissionSchema,
  getWithdrawalFieldErrors,
  type WithdrawalFieldErrors,
} from "@/lib/validations/withdrawals";
import * as transactionService from "@/server/services/transactions";
import { TransactionConflictError } from "@/server/services/transactions";

/**
 * Thin Phase 6 entry point: authenticate → validate → authorize (service)
 * → create WITHDRAWAL + PENDING → safe response.
 */

export type WithdrawalActionState = {
  ok: boolean;
  fieldErrors?: WithdrawalFieldErrors;
  formError?: string;
  transactionId?: string;
  replayed?: boolean;
};

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function toFailure(error: unknown): WithdrawalActionState {
  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      formError:
        error.code === "NOT_FOUND" || error.code === "PROJECT_NOT_FOUND"
          ? "Project not found."
          : "You do not have permission to perform this action.",
    };
  }
  if (error instanceof TransactionConflictError) {
    return { ok: false, formError: error.message };
  }
  return { ok: false, formError: "Something went wrong. Please try again." };
}

export async function submitWithdrawalAction(
  projectSlug: string,
  _prev: WithdrawalActionState | undefined,
  formData: FormData,
): Promise<WithdrawalActionState> {
  const { user } = await requireAuthenticatedUser();

  const parsed = withdrawalSubmissionSchema.safeParse({
    amount: formValue(formData, "amount"),
    paidTo: formValue(formData, "paidTo") || undefined,
    notes: formValue(formData, "notes") || undefined,
    idempotencyKey: formValue(formData, "idempotencyKey"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: getWithdrawalFieldErrors(parsed.error) };
  }

  try {
    const result = await transactionService.submitWithdrawal(
      user.id,
      projectSlug,
      parsed.data,
    );
    revalidatePath(`/projects/${projectSlug}`);
    return {
      ok: true,
      transactionId: result.transaction.id,
      replayed: result.replayed,
    };
  } catch (error) {
    return toFailure(error);
  }
}
