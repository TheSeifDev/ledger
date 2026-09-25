import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/**
 * Server-authoritative session lookup for request handling.
 *
 * Better Auth validates the session cookie from the request headers and
 * returns `{ session, user }` or `null`. Nothing client-controlled takes
 * part in the decision.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Guard for protected pages: resolves the session or redirects to the
 * login page. The redirect target is fixed server-side.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
