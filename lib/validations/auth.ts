import { z } from "zod";

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type SignInInput = z.infer<typeof signInSchema>;

export type SignInFieldErrors = Partial<Record<"email" | "password", string>>;

/**
 * Maps a sign-in payload to field-level messages.
 * Iterates `issues` (works on Zod v3 and v4) and never leaks internals.
 */
export function getSignInFieldErrors(input: {
  email: string;
  password: string;
}): SignInFieldErrors {
  const result = signInSchema.safeParse(input);

  if (result.success) return {};

  const errors: SignInFieldErrors = {};
  if (!input.email.trim()) errors.email = "Email is required.";
  if (!input.password) errors.password = "Password is required.";

  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (key === "email" && !errors.email) errors.email = issue.message;
    if (key === "password" && !errors.password) errors.password = issue.message;
  }
  return errors;
}
