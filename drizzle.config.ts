import { defineConfig } from "drizzle-kit";

import { assertDevelopmentMigrationTarget } from "./db/migration-target";
import { env } from "./lib/env";

/**
 * Deterministic migration tooling:
 * fixed paths, fixed dialect, no interactive `push` workflows.
 *
 * drizzle-kit evaluates this file for every command. Commands that open a
 * database connection (migrate, push, studio, ...) are gated to Neon
 * development branches; offline commands that only touch local files
 * (generate, check, up) are always allowed. Unknown commands fail closed.
 */
const OFFLINE_COMMANDS = new Set(["generate", "check", "up"]);

const command = process.argv
  .slice(2)
  .find((argument) => !argument.startsWith("-"));

if (command === undefined || !OFFLINE_COMMANDS.has(command)) {
  assertDevelopmentMigrationTarget();
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema",
  out: "./drizzle",
  dbCredentials: {
    // Migrations take the direct (unpooled) connection: DDL must not
    // go through PgBouncer.
    url: env.DATABASE_URL_UNPOOLED,
  },
});
