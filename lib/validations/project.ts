import { z } from "zod";

/**
 * Project lifecycle vocabulary. This is the single source of truth: the
 * database enum (src/db/schema/tenancy.ts) is built from this list, so
 * validation, server code, and the schema cannot drift apart.
 */
export const PROJECT_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/**
 * Money is transmitted from the client as a major-unit decimal string
 * ("750.00") and converted here to exact integer minor units ("75000")
 * without floating-point arithmetic.
 */
export const MAJOR_UNIT_PATTERN = /^\d+(\.\d{1,2})?$/;

/** "750.00" → 75000n. Input must already match MAJOR_UNIT_PATTERN. */
export function toMinorUnits(majorUnits: string): bigint {
  const [whole, frac = ""] = majorUnits.trim().split(".");
  const fracPadded = (frac + "00").slice(0, 2);
  return BigInt(whole) * 100n + BigInt(fracPadded);
}

export const projectSlugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(80, "Slug must be 80 characters or fewer.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may only contain lowercase letters, numbers, and hyphens.",
  );

export const projectStatusSchema = z.enum(PROJECT_STATUSES);

export const projectCurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO 4217 code.");

export const projectBudgetSchema = z
  .string()
  .trim()
  .min(1, "Budget is required.")
  .regex(
    MAJOR_UNIT_PATTERN,
    "Enter a non-negative amount with at most 2 decimal places.",
  );

export const createProjectSchema = z.object({
  organizationId: z.string().min(1, "Organization is required."),
  name: z.string().trim().min(1, "Name is required."),
  slug: projectSlugSchema,
  description: z.string().trim().max(1000, "Description must be 1000 characters or fewer.").optional(),
  budget: projectBudgetSchema,
  currency: projectCurrencySchema,
  status: projectStatusSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  slug: projectSlugSchema,
  description: z.string().trim().max(1000, "Description must be 1000 characters or fewer.").optional(),
  budget: projectBudgetSchema,
  currency: projectCurrencySchema,
  status: projectStatusSchema,
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1, "User is required."),
});

export const removeProjectMemberSchema = z.object({
  userId: z.string().min(1, "User is required."),
});

export type ProjectFieldErrors = Partial<
  Record<
    | "organizationId"
    | "name"
    | "slug"
    | "description"
    | "budget"
    | "currency"
    | "status"
    | "userId",
    string
  >
>;

/** Maps a Zod failure to field-level messages without leaking internals. */
export function getProjectFieldErrors(
  error: z.ZodError,
): ProjectFieldErrors {
  const errors: ProjectFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof ProjectFieldErrors | undefined;
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
