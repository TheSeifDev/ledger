import { redirect } from "next/navigation";

import { getSession } from "@/server/session";

/**
 * Public entry point. There is nothing public to see: route by session —
 * authenticated users land in the workspace, everyone else on the login
 * page.
 */
export default async function Home() {
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
