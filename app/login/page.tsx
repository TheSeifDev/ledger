import type { Metadata } from "next";

import { LoginPage } from "@/components/auth/LoginPage";

export const metadata: Metadata = {
  title: "Sign in · PHANTOMS Ledger",
  description:
    "Sign in to the PHANTOMS Ledger — contributions, approvals, withdrawals, and project balances in one internal system.",
};

export default function LoginRoutePage() {
  return <LoginPage />;
}