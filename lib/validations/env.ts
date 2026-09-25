import { z } from "zod";

/**
 * One contract for environment variables, shared by two consumers:
 *
 *   - the Next.js server runtime (src/server/env.ts)
 *   - the drizzle-kit chain (drizzle.config.ts -> src/db/migration-target.ts)
 *
 * This module stays side-effect free (no "server-only" import) because
 * drizzle-kit bundles it outside the Next.js runtime.
 *
 * Errors describe variable names and reasons only — never values.
 */

type EnvSource = Record<string, string | undefined>;

const nodeEnvSchema = z
  .enum(["development", "test", "production"])
  .default("development");

const serverEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  DATABASE_URL: z.string().url("must be a valid PostgreSQL URL"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "must be at least 32 characters (generate with openssl rand -hex 32)"),
  BETTER_AUTH_URL: z.string().url("must be a valid URL"),
});

const migrationEnvSchema = z.object({
  DATABASE_URL_UNPOOLED: z
    .string()
    .url("must be a valid PostgreSQL URL (use the direct endpoint, not the -pooler one)"),
  NEON_BRANCH: z
    .string()
    .min(1, "is required — run `neon checkout <branch>` and update .env"),
  ALLOW_PRODUCTION_MIGRATIONS: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type MigrationEnv = z.infer<typeof migrationEnvSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

export function parseServerEnv(source: EnvSource): ServerEnv {
  const result = serverEnvSchema.safeParse({
    NODE_ENV: source.NODE_ENV,
    DATABASE_URL: source.DATABASE_URL,
    BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: source.BETTER_AUTH_URL,
  });

  if (!result.success) {
    throw new Error(
      `Invalid server environment (${formatIssues(result.error)}). ` +
        "Fix .env — see .env.example. Never commit real values.",
    );
  }

  return result.data;
}

export function parseMigrationEnv(source: EnvSource): MigrationEnv {
  const result = migrationEnvSchema.safeParse({
    DATABASE_URL_UNPOOLED: source.DATABASE_URL_UNPOOLED,
    NEON_BRANCH: source.NEON_BRANCH,
    ALLOW_PRODUCTION_MIGRATIONS: source.ALLOW_PRODUCTION_MIGRATIONS,
  });

  if (!result.success) {
    throw new Error(
      `Invalid migration environment (${formatIssues(result.error)}). ` +
        "Fix .env — see .env.example. Never commit real values.",
    );
  }

  return result.data;
}
