import { z } from "zod";

import { MAJOR_UNIT_PATTERN, toMinorUnits } from "./project.ts";

/**
 * Authoritative transaction vocabulary. Single source of truth: the
 * database enums (src/db/schema/transactions.ts) are built from these
 * lists so validation, server code, and rows cannot drift apart.
 */
export const TRANSACTION_TYPES = ["PAYMENT", "WITHDRAWAL"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_NOTES_MAX = 255;
export const IDEMPOTENCY_KEY_MIN = 16;
export const IDEMPOTENCY_KEY_MAX = 128;

export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);
export const transactionStatusSchema = z.enum(TRANSACTION_STATUSES);

/**
 * Money moves as a major-unit decimal string from the client ("750.00")
 * and is converted to exact integer minor units ("75000") — never floats.
 * Amounts must be strictly positive.
 */
export const transactionAmountSchema = z
  .string()
  .trim()
  .min(1, "Amount is required.")
  .regex(
    MAJOR_UNIT_PATTERN,
    "Enter a positive amount with at most 2 decimal places.",
  )
  .refine(
    (value) => !MAJOR_UNIT_PATTERN.test(value) || toMinorUnits(value) > 0n,
    { message: "Amount must be greater than zero." },
  );

export const transactionNotesSchema = z
  .string()
  .trim()
  .max(
    TRANSACTION_NOTES_MAX,
    `Notes must be ${TRANSACTION_NOTES_MAX} characters or fewer.`,
  )
  .optional();

export const transactionPaidToSchema = z
  .string()
  .trim()
  .min(1, "Recipient must not be blank.")
  .max(200, "Recipient must be 200 characters or fewer.")
  .optional();

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(IDEMPOTENCY_KEY_MIN, "Idempotency key must be at least 16 characters.")
  .max(IDEMPOTENCY_KEY_MAX, "Idempotency key must be at most 128 characters.");

/**
 * Payload for a new PENDING transaction. Organization, project, creator,
 * and status are never client-authoritative — the service derives them.
 */
export const createTransactionSchema = z.object({
  type: transactionTypeSchema,
  amount: transactionAmountSchema,
  paidTo: transactionPaidToSchema,
  notes: transactionNotesSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const TRANSACTION_PAGE_DEFAULT_LIMIT = 25;
export const TRANSACTION_PAGE_MAX_LIMIT = 50;

/**
 * Cursor format: `${createdAt.toISOString()}|${id}` (checked in – not
 * date-arithmetic), base64url-encoded by the repository. Keyset pagination
 * over (created_at, id) keeps pages stable while transactions are added.
 */
export const listTransactionsQuerySchema = z.object({
  type: transactionTypeSchema.optional(),
  status: transactionStatusSchema.optional(),
  createdByUserId: z.string().min(1).optional(),
  cursor: z.string().min(1).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(
      TRANSACTION_PAGE_MAX_LIMIT,
      `Page size must be at most ${TRANSACTION_PAGE_MAX_LIMIT}.`,
    )
    .default(TRANSACTION_PAGE_DEFAULT_LIMIT),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

export type TransactionFieldErrors = Partial<
  Record<"type" | "amount" | "paidTo" | "notes" | "idempotencyKey" | "limit", string>
>;

export function getTransactionFieldErrors(error: z.ZodError): TransactionFieldErrors {
  const errors: TransactionFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof TransactionFieldErrors | undefined;
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
