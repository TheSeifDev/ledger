import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginPage } from "@/components/auth/LoginPage";
import { getSession } from "@/server/session";

export const metadata: Metadata = {
  title: "Sign in · PHANTOMS Ledger",
  description:
    "Sign in to the PHANTOMS Ledger — contributions, approvals, withdrawals, and project balances in one internal system.",
};

export default async function LoginRoutePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return <LoginPage />;
}
