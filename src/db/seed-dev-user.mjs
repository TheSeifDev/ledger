// Dev-only pre-provisioned user seeder (npm run db:seed-user).
//
// There is no public account creation path in this application. This
// script is the documented way to provision a user with a Better Auth
// credential account (email + password) on a development branch.
//
// It writes the same rows Better Auth's sign-up flow would create:
// one "user" row and one credential "account" row whose password is
// hashed with better-auth/crypto's hashPassword — the exact function
// Better Auth uses to verify credentials at sign-in.
//
// Refuses to run while NEON_BRANCH=production, and refuses when
// NEON_BRANCH is unset (an unverified target is not writable).
//
// Usage:
//   npm run db:seed-user -- --email you@example.com --password 'correct horse' --name 'You'
//
// Re-running with the same email refreshes the name and password —
// this doubles as the dev-only "I forgot my local password" reset,
// since no password-reset flow exists in this phase.
//
// Never prints the password or connection strings — email and branch
// name only.

import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

const {
  values: { email, password, name },
} = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
    name: { type: "string" },
  },
});

const branch = process.env.NEON_BRANCH;
const url = process.env.DATABASE_URL;

if (branch === "production") {
  console.error(
    [
      "Refusing to seed a user: NEON_BRANCH=production.",
      "",
      "Seeding writes rows; it must only target a development branch:",
      "  1. neon checkout <branch>   # create or switch a Neon branch",
      "  2. update .env: NEON_BRANCH, DATABASE_URL, DATABASE_URL_POOLED,",
      "     DATABASE_URL_UNPOOLED",
      "  3. npm run db:seed-user -- --email ... --password ... --name ...",
    ].join("\n"),
  );
  process.exit(1);
}

if (!branch) {
  console.error(
    "NEON_BRANCH is not set — refusing to write to an unverified target. Point .env at a development branch first.",
  );
  process.exit(1);
}

if (!url) {
  console.error("DATABASE_URL is not set — copy .env.example to .env and fill it in.");
  process.exit(1);
}

if (!email || !password || !name) {
  console.error(
    "Usage: npm run db:seed-user -- --email you@example.com --password 'correct horse' --name 'You'",
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("Password must be at least 8 characters (Better Auth's default minimum).");
  process.exit(1);
}

const normalizedEmail = email.trim().toLowerCase();

const { Pool } = await import("pg");
const { hashPassword } = await import("better-auth/crypto");

const pool = new Pool({ connectionString: url, max: 1 });

try {
  const hash = await hashPassword(password);

  const {
    rows: [user],
  } = await pool.query(
    `insert into "user" (id, name, email)
     values ($1, $2, $3)
     on conflict (email) do update set name = excluded.name, updated_at = now()
     returning id`,
    [randomUUID(), name.trim(), normalizedEmail],
  );

  await pool.query(
    `insert into "account" (id, user_id, account_id, provider_id, password)
     values ($1, $2, $2, 'credential', $3)
     on conflict (provider_id, account_id) do update set password = excluded.password, updated_at = now()`,
    [randomUUID(), user.id, hash],
  );

  console.log(`ok — provisioned ${normalizedEmail} (branch: ${branch})`);
} catch (error) {
  console.error(`failed — ${(error && error.message) || "unknown error"}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
