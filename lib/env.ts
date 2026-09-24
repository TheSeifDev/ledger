import { z } from "zod";

/**
 * Typed environment contract for PHANTOMS Ledger.
 *
 * Parsed once at first import; missing or invalid variables fail fast
 * with an explicit message naming every offending variable.
 *
 * This module must stay tooling-portable: it is imported by the Next.js
 * app, by drizzle-kit (through drizzle.config.ts), and must not depend
 * on anything beyond `zod` and `process.env`.
 */

const postgresUrl = z
  .string()
  .startsWith("postgres", "expected a postgresql:// connection string");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Neon PostgreSQL connection strings.
  // DATABASE_URL is the generic value (also written by the Neon CLI tooling);
  // the pooled/unpooled pair below is what the application and drizzle-kit use.
  DATABASE_URL: postgresUrl.optional(),
  // Pooled (PgBouncer) — application runtime connections.
  DATABASE_URL_POOLED: postgresUrl,
  // Unpooled (direct) — migrations, which must not go through PgBouncer.
  DATABASE_URL_UNPOOLED: postgresUrl,

  // Neon branch this environment targets. Migration commands refuse to
  // run against "production" (see db/migration-target.ts).
  NEON_BRANCH: z.string().min(1).optional(),
  // Escape hatch for reviewed, intentional production migrations only.
  ALLOW_PRODUCTION_MIGRATIONS: z.enum(["true", "1"]).optional(),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;

export type EnvIssue = { path: string; message: string };

export class EnvironmentValidationError extends Error {
  readonly issues: readonly EnvIssue[];

  constructor(issues: readonly EnvIssue[]) {
    super(
      [
        "Invalid environment — the following variables are missing or invalid:",
        ...issues.map((issue) => `  ${issue.path}: ${issue.message}`),
        "",
        "Copy .env.example to .env and fill in real values. Never commit real values.",
      ].join("\n")
    );
    this.name = "EnvironmentValidationError";
    this.issues = issues;
  }
}

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    throw new EnvironmentValidationError(
      result.error.issues.map((issue) => ({
        path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
        message: issue.message,
      }))
    );
  }

  return result.data;
}

export const env: Env = parseEnv();
