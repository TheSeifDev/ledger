import { defineConfig } from "drizzle-kit";

import { parseMigrationEnv } from "./lib/validations/env";

/**
 * Migration safety gate (ARCHITECTURE.md §30–31, README §15/§18).
 *
 * drizzle-kit loads this file for every command, so the gate runs first:
 *
 *   1. load .env (drizzle-kit does not do this itself),
 *   2. validate the migration environment,
 *   3. refuse database-touching commands while NEON_BRANCH=production,
 *      unless ALLOW_PRODUCTION_MIGRATIONS=true for a reviewed migration.
 *
 * Offline commands such as `drizzle-kit generate` always stay allowed.
 *
 * The import above is relative on purpose: drizzle-kit bundles this file
 * with esbuild and does not resolve the tsconfig `@/*` aliases.
 */

const DATABASE_TOUCHING_COMMANDS = new Set([
  "migrate",
  "push",
  "pull",
  "introspect",
  "check",
  "drop",
  "studio",
]);

function loadLocalEnvFile(): void {
  // Real environment values always win; .env only fills the gaps (CI and
  // production have no .env file, which is fine).
  try {
    process.loadEnvFile();
  } catch {
    // .env is optional — validation reports what is actually missing.
  }
}

function currentDrizzleKitCommand(): string | undefined {
  return process.argv.slice(2).find((arg) => !arg.startsWith("-"));
}

function refuseProductionMigration(command: string): never {
  throw new Error(
    [
      `Refusing \`drizzle-kit ${command}\`: NEON_BRANCH=production.`,
      "",
      "Local development must not casually target the production database.",
      "To work against a development branch:",
      "  1. neon checkout <branch>      # create or switch a Neon branch",
      "  2. update .env: NEON_BRANCH, DATABASE_URL, DATABASE_URL_POOLED,",
      "     DATABASE_URL_UNPOOLED",
      "  3. npm run db:migrate",
      "",
      "For a reviewed production migration, set ALLOW_PRODUCTION_MIGRATIONS=true",
      "for that single run.",
    ].join("\n"),
  );
}

loadLocalEnvFile();

const migrationEnv = parseMigrationEnv(process.env);
const command = currentDrizzleKitCommand();
const isProductionBranch = migrationEnv.NEON_BRANCH === "production";

if (isProductionBranch && command && DATABASE_TOUCHING_COMMANDS.has(command)) {
  if (migrationEnv.ALLOW_PRODUCTION_MIGRATIONS !== "true") {
    refuseProductionMigration(command);
  }
  console.warn(
    "ALLOW_PRODUCTION_MIGRATIONS=true — proceeding against the production branch.",
  );
}

if (migrationEnv.DATABASE_URL_UNPOOLED.includes("-pooler.")) {
  console.warn(
    "DATABASE_URL_UNPOOLED looks like a pooled endpoint — migrations should use the direct endpoint.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  // Migrations run against the direct endpoint: DDL and advisory locks do
  // not belong behind PgBouncer transaction pooling.
  dbCredentials: { url: migrationEnv.DATABASE_URL_UNPOOLED },
  strict: true,
  verbose: true,
});
