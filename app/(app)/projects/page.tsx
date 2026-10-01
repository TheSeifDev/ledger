import type { Metadata } from "next";
import Link from "next/link";

import { requireSession } from "@/server/session";
import { listProjects, listManageableOrganizations } from "@/server/services/projects";
import { findOrganizationMembershipsForUser } from "@/server/repositories/tenancy";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProjectCreateForm } from "@/components/projects/ProjectCreateForm";
import { formatMinorUnits } from "@/lib/finance/money";

export const metadata: Metadata = {
  title: "Projects · PHANTOMS Ledger",
  description: "Projects within your organizations.",
};

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { user } = await requireSession();

  const memberships = await findOrganizationMembershipsForUser(user.id);
  if (memberships.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
        <div className="w-full max-w-3xl">
          <h1 className="text-2xl font-heading font-medium text-foreground">Projects</h1>
          <Card className="mt-6">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                You are not a member of any organization. Contact an administrator
                to be added before you can see or create projects.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const [projects, manageableOrgs] = await Promise.all([
    listProjects(user.id),
    listManageableOrganizations(user.id),
  ]);

  return (
    <main className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <div className="w-full max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-medium text-foreground">Projects</h1>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Dashboard
          </Link>
        </div>

        <section aria-labelledby="project-list-heading">
          <h2 id="project-list-heading" className="sr-only">
            Your projects
          </h2>
          {projects.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  You are not a member of any project yet. Create one below.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.slug}`} className="block">
                    <Card className="transition-shadow hover:ring-foreground/25">
                      <CardHeader>
                        <div className="flex items-baseline justify-between gap-4">
                          <CardTitle>{p.name}</CardTitle>
                          <span
                            className={
                              p.status === "ACTIVE"
                                ? "inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                                : "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                            }
                          >
                            {p.status === "ACTIVE" ? "Active" : "Archived"}
                          </span>
                        </div>
                        <CardDescription>
                          {p.organizationName} · {formatMinorUnits(p.budgetMinorUnits, p.currency)}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {manageableOrgs.length > 0 ? (
          <section aria-labelledby="create-project-heading">
            <Card>
              <CardHeader>
                <CardTitle id="create-project-heading">Create project</CardTitle>
                <CardDescription>
                  Starts a new project container. Budgets and finances are managed in later steps.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProjectCreateForm
                  organizations={manageableOrgs.map((o) => ({
                    organizationId: o.organizationId,
                    name: o.name,
                  }))}
                />
              </CardContent>
            </Card>
          </section>
        ) : (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground">
                Only organization owners and heads can create projects.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
