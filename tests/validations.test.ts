// Unit tests: sign-in input validation (lib/validations/auth.ts) and the
// env contract (lib/validations/env.ts). Pure functions, no database.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getSignInFieldErrors,
  signInSchema,
} from "../lib/validations/auth.ts";
import {
  parseMigrationEnv,
  parseServerEnv,
} from "../lib/validations/env.ts";

describe("getSignInFieldErrors", () => {
  it("accepts a valid email and password", () => {
    assert.deepEqual(
      getSignInFieldErrors({
        email: "member@phantoms.io",
        password: "correct horse battery staple",
      }),
      {},
    );
  });

  it("rejects invalid input early: missing email", () => {
    const errors = getSignInFieldErrors({ email: "", password: "irrelevant" });
    assert.equal(errors.email, "Email is required.");
    assert.equal(errors.password, undefined);
  });

  it("rejects invalid input early: whitespace-only email", () => {
    const errors = getSignInFieldErrors({ email: "   ", password: "irrelevant" });
    assert.equal(errors.email, "Email is required.");
  });

  it("rejects invalid input early: malformed email", () => {
    const errors = getSignInFieldErrors({ email: "not-an-email", password: "x" });
    assert.equal(errors.email, "Enter a valid email address.");
  });

  it("rejects invalid input early: missing password", () => {
    const errors = getSignInFieldErrors({ email: "member@phantoms.io", password: "" });
    assert.equal(errors.password, "Password is required.");
    assert.equal(errors.email, undefined);
  });

  it("does not silently coerce a login payload into a session: schema stays strict", () => {
    // The schema must never pass extra fields through as "valid sign-in".
    const result = signInSchema.safeParse({
      email: "member@phantoms.io",
      password: "pw",
      role: "owner", // untrusted client-controlled field
    });
    assert.equal(result.success, true); // zod strips unknown keys…
    assert.equal("role" in (result.success ? result.data : {}), false);
  });
});

describe("env contract", () => {
  it("accepts a valid server env", () => {
    const env = parseServerEnv({
      DATABASE_URL: "postgresql://user:pass@host/db",
      BETTER_AUTH_SECRET: "a".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
    });
    assert.equal(env.BETTER_AUTH_URL, "http://localhost:3000");
  });

  it("refuses a short BETTER_AUTH_SECRET", () => {
    assert.throws(
      () =>
        parseServerEnv({
          DATABASE_URL: "postgresql://user:pass@host/db",
          BETTER_AUTH_SECRET: "too-short",
          BETTER_AUTH_URL: "http://localhost:3000",
        }),
    );
  });

  it("refuses a non-URL DATABASE_URL", () => {
    assert.throws(
      () =>
        parseServerEnv({
          DATABASE_URL: "not a url",
          BETTER_AUTH_SECRET: "a".repeat(32),
          BETTER_AUTH_URL: "http://localhost:3000",
        }),
    );
  });

  it("exposes NEON_BRANCH for the migration gate", () => {
    const env = parseMigrationEnv({
      DATABASE_URL_UNPOOLED: "postgresql://user:pass@host/db",
      NEON_BRANCH: "development",
    });
    assert.equal(env.NEON_BRANCH, "development");
    assert.equal(env.ALLOW_PRODUCTION_MIGRATIONS, undefined);
  });

  it("refuses a migration env without NEON_BRANCH", () => {
    assert.throws(() =>
      parseMigrationEnv({
        DATABASE_URL_UNPOOLED: "postgresql://user:pass@host/db",
      }),
    );
  });
});
