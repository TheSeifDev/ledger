import type { Metadata } from "next";

import { logout } from "@/actions/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/server/session";

export const metadata: Metadata = {
  title: "Dashboard · PHANTOMS Ledger",
  description: "Internal finance workspace overview.",
};

export default async function DashboardPage() {
  const { user } = await requireSession();

  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-16 font-sans">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Signed in as {user.name}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex h-10 w-full items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:opacity-90"
            >
              Sign out
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
