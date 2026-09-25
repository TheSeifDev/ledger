// Shared fixtures for the Phase 1 auth tests.
//
// Tests run against the development Neon branch (the migration gate keeps
// them away from production). Fixture users are provisioned exactly like
// production provisioning: a direct row insert with a
// better-auth/crypto password hash — the same functions Better Auth uses
// to verify credentials. Nothing here is imported by application code.

import { randomUUID } from "node:crypto";
import pg from "pg";

import { parseServerEnv } from "../lib/validations/env.ts";

export const testEnv = parseServerEnv(process.env);

export type FixtureSpec = {
  email: string;
  password: string;
  name: string;
};

// Each DB-backed suite owns a distinct fixture identity. Node's test
// runner executes the listed test files concurrently, so two suites
// sharing one user would delete each other's rows in resetFixture()
// mid-test — the other suite's session inserts would then violate the
// user foreign key.
export const AUTH_FIXTURE: FixtureSpec = {
  email: "phase1-auth-test@ledger.test",
  password: "phase1-test-password-2026",
  name: "Phase 1 Test User",
};

export const ROUTES_FIXTURE: FixtureSpec = {
  email: "phase1-routes-test@ledger.test",
  password: "phase1-routes-password-2026",
  name: "Phase 1 Routes Test User",
};

export type Fixture = {
  userId: string;
  email: string;
  password: string;
  name: string;
};

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: testEnv.DATABASE_URL, max: 1 });
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Removes any previous fixture run (user, and its sessions/accounts via
 * cascade) so each run starts from a clean, deterministic state.
 */
export async function resetFixture(spec: FixtureSpec = AUTH_FIXTURE): Promise<void> {
  await getPool().query(`delete from "user" where email = $1`, [spec.email]);
}

/**
 * Provisions the fixture user the same way the dev-only seeder does
 * (src/db/seed-dev-user.mjs): raw rows + Better Auth's own password
 * hashing. This is intentionally NOT a sign-up call.
 */
export async function provisionFixture(spec: FixtureSpec = AUTH_FIXTURE): Promise<Fixture> {
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(spec.password);

  const { rows } = await getPool().query(
    `insert into "user" (id, name, email)
     values ($1, $2, $3)
     on conflict (email) do update set name = excluded.name, updated_at = now()
     returning id`,
    [randomUUID(), spec.name, spec.email],
  );
  const userId = rows[0].id;

  await getPool().query(
    `insert into "account" (id, user_id, account_id, provider_id, password)
     values ($1, $2, $2, 'credential', $3)
     on conflict (provider_id, account_id) do update set password = excluded.password, updated_at = now()`,
    [randomUUID(), userId, hash],
  );

  return { userId, email: spec.email, password: spec.password, name: spec.name };
}

/**
 * The session cookie pair(s) a browser would store after a Better Auth
 * sign-in. Better Auth signs the session-token cookie value with the
 * auth secret (payload.signature), so tests must harvest the Set-Cookie
 * a real sign-in produced — the raw DB token cannot be forged into a
 * valid cookie.
 */
export const SESSION_COOKIE_PREFIX = "better-auth.session_token=";

export function sessionCookiePairsFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .filter((cookie) => cookie.startsWith(SESSION_COOKIE_PREFIX))
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

export function headersWithCookie(cookie?: string): Headers {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return headers;
}
