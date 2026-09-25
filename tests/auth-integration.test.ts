// Integration tests: authentication semantics against the development
// database, through a Better Auth instance configured exactly like the
// app's (lib/auth.ts): Drizzle adapter, the same schema, sign-up
// disabled. `lib/auth.ts` itself cannot be imported here because it is
// server-only — this mirror validates the same configuration wiring.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/node-postgres";

// Imported from auth.ts directly (not the barrel): Node's type-stripping
// loader requires explicit extensions for relative imports, and the
// app's barrel uses bundler-style extensionless imports. The object is
// identical to what src/db/schema/index.ts re-exports.
import * as schema from "../src/db/schema/auth.ts";
import {
  closePool,
  getPool,
  headersWithCookie,
  provisionFixture,
  resetFixture,
  sessionCookiePairsFrom,
  testEnv,
} from "./helpers.ts";

const pool = getPool();
const db = drizzle(pool, { schema });

// Mirrors lib/auth.ts (server-only) for a plain Node test process.
const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: testEnv.BETTER_AUTH_SECRET,
  baseURL: testEnv.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true, disableSignUp: true },
});

type SignedIn = {
  token: string;
  cookie: string;
  userId: string;
};

/**
 * Signs the fixture in through the mirrored instance and returns the raw
 * DB token (for row assertions) plus the exact Set-Cookie pair Better
 * Auth issued (for replaying requests as a browser would).
 */
async function signInFixture(): Promise<SignedIn> {
  const response = await auth.api.signInEmail({
    body: {
      email: "phase1-auth-test@ledger.test",
      password: "phase1-test-password-2026",
    },
    asResponse: true,
  });

  const raw = await response.text();
  assert.equal(response.status, 200, raw);

  const cookie = sessionCookiePairsFrom(response);
  assert.ok(cookie, "sign-in must set a session cookie");

  const body = JSON.parse(raw) as { token: string; user: { id: string } };
  return { token: body.token, cookie, userId: body.user.id };
}

before(async () => {
  await resetFixture();
});

after(async () => {
  await resetFixture();
  await closePool();
});

describe("login", () => {
  it("succeeds for the pre-provisioned user and establishes a session", async () => {
    const fixture = await provisionFixture();
    const { token, userId } = await signInFixture();

    assert.equal(userId, fixture.userId);

    const { rows } = await pool.query(
      `select user_id, expires_at from "session" where token = $1`,
      [token],
    );
    assert.equal(rows.length, 1, "sign-in must persist exactly one session row");
    assert.equal(rows[0].user_id, fixture.userId);
    assert.ok(new Date(rows[0].expires_at).getTime() > Date.now());
  });

  it("fails safely for a wrong password", async () => {
    await provisionFixture();

    await assert.rejects(
      auth.api.signInEmail({
        body: { email: "phase1-auth-test@ledger.test", password: "wrong-password" },
      }),
      (error: { statusCode?: number }) => error.statusCode === 401,
    );
  });

  it("fails safely for a non-existent user and creates no account", async () => {
    const { rows: before } = await pool.query(
      `select count(*)::int as count from "user" where email = $1`,
      ["ghost@ledger.test"],
    );
    assert.equal(before[0].count, 0);

    await assert.rejects(
      auth.api.signInEmail({
        body: { email: "ghost@ledger.test", password: "whatever-password" },
      }),
      (error: { statusCode?: number }) => error.statusCode === 401,
    );

    const { rows: after } = await pool.query(
      `select count(*)::int as count from "user" where email = $1`,
      ["ghost@ledger.test"],
    );
    assert.equal(after[0].count, 0, "login attempts must not create users");
  });

  it("has no public account creation path: sign-up is rejected", async () => {
    await assert.rejects(
      auth.api.signUpEmail({
        body: {
          email: "sign-up-should-fail@ledger.test",
          password: "should-not-matter",
          name: "Rejected",
        },
      }),
      (error: { statusCode?: number; body?: { code?: string } }) =>
        error.statusCode === 400 &&
        error.body?.code === "EMAIL_PASSWORD_SIGN_UP_DISABLED",
    );
  });
});

describe("session", () => {
  it("resolves for a valid session and returns the owning user", async () => {
    const fixture = await provisionFixture();
    const { token, cookie } = await signInFixture();

    const session = await auth.api.getSession({ headers: headersWithCookie(cookie) });
    assert.ok(session, "valid session must resolve");
    assert.equal(session.user.id, fixture.userId);
    assert.equal(session.user.email, fixture.email);
    assert.ok(session.session.token === token);
    assert.ok(session.session.expiresAt.getTime() > Date.now());
  });

  it("is denied without a cookie", async () => {
    const session = await auth.api.getSession({ headers: headersWithCookie() });
    assert.equal(session, null);
  });

  it("treats a garbage token as unauthenticated", async () => {
    const session = await auth.api.getSession({
      headers: headersWithCookie("better-auth.session_token=not-a-real-token"),
    });
    assert.equal(session, null);
  });

  it("treats an expired session as unauthenticated", async () => {
    await provisionFixture();
    const { token, cookie } = await signInFixture();

    await pool.query(
      `update "session" set expires_at = now() - interval '1 hour' where token = $1`,
      [token],
    );

    const session = await auth.api.getSession({ headers: headersWithCookie(cookie) });
    assert.equal(session, null, "expired sessions must not authenticate");
  });

  it("cannot be substituted by client-controlled identifiers", async () => {
    // Resolve the session while the request carries a spoofed second
    // identity in a client-controlled header. The session owner must
    // come from the server-side token lookup alone — never from
    // anything the client claims.
    const fixture = await provisionFixture();
    const { cookie } = await signInFixture();

    const headers = headersWithCookie(cookie);
    headers.set("x-user-id", "00000000-0000-0000-0000-000000000000");

    const session = await auth.api.getSession({ headers });
    assert.ok(session);
    assert.equal(
      session.user.id,
      fixture.userId,
      "identity must come from the session token, not client headers",
    );
  });
});

describe("logout", () => {
  it("invalidates the session through Better Auth; the old session cannot authenticate afterwards", async () => {
    const fixture = await provisionFixture();
    const { token, cookie } = await signInFixture();

    let session = await auth.api.getSession({ headers: headersWithCookie(cookie) });
    assert.ok(session);

    await auth.api.signOut({ headers: headersWithCookie(cookie) });

    const { rows } = await pool.query(
      `select count(*)::int as count from "session" where token = $1 and user_id = $2`,
      [token, fixture.userId],
    );
    assert.equal(rows[0].count, 0, "sign-out must delete the session row");

    session = await auth.api.getSession({ headers: headersWithCookie(cookie) });
    assert.equal(session, null, "the invalidated session must not authenticate");
  });
});
