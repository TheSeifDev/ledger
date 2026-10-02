import { z } from "zod";

import {
  transactionAmountSchema,
  transactionNotesSchema,
  transactionPaidToSchema,
  idempotencyKeySchema,
} from "./transactions.ts";

/**
 * Phase 5 payment submission contract.
 *
 * The client may only supply amount / paid_to / notes / idempotency key.
 * type (= PAYMENT), status (= PENDING), organization, project, creator,
 * and approval metadata are derived server-side and are not part of this
 * payload at all — there is nothing to tamper with.
 */
export const paymentSubmissionSchema = z.object({
  amount: transactionAmountSchema,
  paidTo: transactionPaidToSchema,
  notes: transactionNotesSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type PaymentSubmissionInput = z.infer<typeof paymentSubmissionSchema>;

export type PaymentFieldErrors = Partial<
  Record<"amount" | "paidTo" | "notes" | "idempotencyKey", string>
>;

export function getPaymentFieldErrors(error: z.ZodError): PaymentFieldErrors {
  const errors: PaymentFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof PaymentFieldErrors | undefined;
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
