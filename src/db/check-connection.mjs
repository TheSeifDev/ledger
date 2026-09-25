// Read-only database connectivity probe (npm run db:check).
//
// Runs `select 1` and nothing else: no catalog reads, no session state
// changes, no schema introspection. Never prints connection strings —
// branch name and result only (AGENTS.md §23).

const branch = process.env.NEON_BRANCH ?? "(NEON_BRANCH not set)";
const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set — copy .env.example to .env and fill it in.");
  process.exit(1);
}

if (branch === "production") {
  console.warn(
    "NEON_BRANCH=production — probing the PRODUCTION database with a read-only `select 1`.",
  );
}

const { Pool } = await import("pg");

const pool = new Pool({ connectionString: url, max: 1 });

try {
  await pool.query("select 1");
  console.log(`ok — connected (branch: ${branch})`);
} catch (error) {
  console.error(`failed — ${(error && error.message) || "unknown error"}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
