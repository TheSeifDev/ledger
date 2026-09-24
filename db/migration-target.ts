import { env } from "../lib/env";

/**
 * Guards connecting drizzle-kit commands against the Neon production
 * branch. The production database is never used for local migration
 * experimentation (ARCHITECTURE.md §12, SECURITY.md §9).
 *
 * Fails closed: a missing NEON_BRANCH is treated as unsafe, because the
 * target of the connection strings cannot be verified.
 *
 * Escape hatch: ALLOW_PRODUCTION_MIGRATIONS=true, for reviewed and
 * intentional production migrations only.
 */
export function assertDevelopmentMigrationTarget(): void {
  if (env.ALLOW_PRODUCTION_MIGRATIONS) {
    return;
  }

  const branch = env.NEON_BRANCH;

  if (branch && branch !== "production") {
    return;
  }

  const detail = branch ? `"production"` : "not set (target unverifiable)";

  throw new Error(
    [
      "Refusing a database-touching command on an unsafe migration target.",
      `NEON_BRANCH is ${detail}, so the connection strings may point at the Neon production branch.`,
      "",
      "To work locally:",
      "  1. Point .env at a Neon development branch and set NEON_BRANCH",
      "     to its name (for example via `neon checkout <branch>`).",
      "  2. Re-run this command.",
      "",
      "To run a reviewed, intentional production migration:",
      "  set ALLOW_PRODUCTION_MIGRATIONS=true",
    ].join("\n")
  );
}
