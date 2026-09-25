import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";

import { db } from "@/db";
import { env } from "@/server/env";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // There is no public account creation path: users are pre-provisioned
    // through the dev-only seeder (src/db/seed-dev-user.mjs). Better Auth
    // rejects sign-up requests while this is set.
    disableSignUp: true,
  },
});
