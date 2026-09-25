import { betterAuth } from "better-auth";
import { Pool } from "pg";

import { env } from "@/server/env";

// Phase 0 wires configuration only: the Better Auth Drizzle adapter and
// auth schema are Phase 1 work.
const database = new Pool({ connectionString: env.DATABASE_URL });

export const auth = betterAuth({
  database,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true },
});
