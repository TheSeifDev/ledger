import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/lib/env";

/**
 * Server-side Drizzle client for Neon PostgreSQL.
 *
 * Uses the Neon serverless HTTP driver over the POOLED connection string,
 * which is the correct target for short-lived serverless runtimes.
 *
 * Migrations do NOT use this client — drizzle-kit connects through the
 * UNPOOLED string configured in drizzle.config.ts.
 */
export const db = drizzle(neon(env.DATABASE_URL_POOLED));
