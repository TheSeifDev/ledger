import "server-only";

import { parseServerEnv } from "@/lib/validations/env";

/**
 * Validated server environment.
 *
 * Server code imports this instead of reading process.env directly, so a
 * missing or malformed variable fails fast at import time with a clear
 * message — and the module can never end up in a client bundle.
 */
export const env = parseServerEnv(process.env);
