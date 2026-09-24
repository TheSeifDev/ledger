import { betterAuth } from "better-auth";
import { Pool } from "pg";

import { env } from "@/lib/env";

/**
 * Better Auth instance.
 *
 * The foundation phase only wires the existing scaffold to the typed
 * environment: connection, secret, and base URL come from .env now.
 * Drizzle-adapter integration and session customization arrive with the
 * auth phase. Login is email/password only; accounts are provisioned in
 * the database — no public registration.
 */
const database = new Pool({
  connectionString: env.DATABASE_URL_POOLED,
});

export const auth = betterAuth({
  database,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true },
});
