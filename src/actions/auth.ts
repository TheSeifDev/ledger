"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/**
 * Sign out through Better Auth: revokes the active session server-side
 * (the session row is deleted from the database), then redirects to the
 * login page. Never a client-only cookie clear.
 */
export async function logout() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
