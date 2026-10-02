"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser, AuthorizationError } from "@/server/guards/auth";
import {
  paymentSubmissionSchema,
  getPaymentFieldErrors,
  type PaymentFieldErrors,
} from "@/lib/validations/payments";
import { submitPayment } from "@/server/services/transactions";
import { TransactionConflictError } from "@/server/services/transactions";

/**
 * Phase 5 payment submission boundary: authenticate → validate →
 * authorize (service) → create PAYMENT + PENDING → safe result.
 * The form never sends type/status/organization/project/creator; the
 * action never accepts them.
 */

export type PaymentActionState = {
  ok: boolean;
  fieldErrors?: PaymentFieldErrors;
  formError?: string;
  transactionId?: string;
  replayed?: boolean;
};

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function toFailure(error: unknown): PaymentActionState {
  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      formError: "You do not have permission to submit payments to this project.",
    };
  }
  if (error instanceof TransactionConflictError) {
    return { ok: false, formError: error.message };
  }
  return { ok: false, formError: "Payment submission failed. Please try again." };
}

export async function submitPaymentAction(
  projectSlug: string,
  _prev: PaymentActionState | undefined,
  formData: FormData,
): Promise<PaymentActionState> {
  const { user } = await requireAuthenticatedUser();

  const parsed = paymentSubmissionSchema.safeParse({
    amount: formValue(formData, "amount"),
    paidTo: formValue(formData, "paidTo") || undefined,
    notes: formValue(formData, "notes") || undefined,
    idempotencyKey: formValue(formData, "idempotencyKey"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: getPaymentFieldErrors(parsed.error) };
  }

  try {
    const result = await submitPayment(user.id, projectSlug, parsed.data);
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
