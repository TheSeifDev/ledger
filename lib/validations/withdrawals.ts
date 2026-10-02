import { z } from "zod";

import {
  transactionAmountSchema,
  transactionNotesSchema,
  transactionPaidToSchema,
  idempotencyKeySchema,
} from "./transactions.ts";

/**
 * Phase 6 withdrawal submission contract.
 *
 * The client may only supply amount / paid_to / notes / idempotency key.
 * type (= WITHDRAWAL), status (= PENDING), organization, project, creator,
 * and approval metadata are derived server-side and are not part of this
 * payload at all — there is nothing to tamper with.
 *
 * Submission has no approved financial impact; balances and aggregates are
 * computed later on APPROVED rows only.
 */
export const withdrawalSubmissionSchema = z.object({
  amount: transactionAmountSchema,
  paidTo: transactionPaidToSchema,
  notes: transactionNotesSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type WithdrawalSubmissionInput = z.infer<typeof withdrawalSubmissionSchema>;

export type WithdrawalFieldErrors = Partial<
  Record<"amount" | "paidTo" | "notes" | "idempotencyKey", string>
>;

export function getWithdrawalFieldErrors(error: z.ZodError): WithdrawalFieldErrors {
  const errors: WithdrawalFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof WithdrawalFieldErrors | undefined;
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
