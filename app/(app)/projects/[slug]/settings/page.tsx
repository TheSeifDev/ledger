import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/server/session";
import {
  getProject,
  listProjectMembers,
  listEligibleMembers,
} from "@/server/services/projects";
import { AuthorizationError } from "@/server/guards/auth";
import { can, Permission } from "@/lib/permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProjectEditForm } from "@/components/projects/ProjectEditForm";
import { ProjectMembersManager } from "@/components/projects/ProjectMembersManager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Project settings · PHANTOMS Ledger",
  description: "Edit project metadata and manage membership.",
};

function toMajorUnits(minor: bigint): string {
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const whole = absolute / 100n;
  const frac = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireSession();

  let access;
  try {
    access = await getProject(user.id, slug);
  } catch (error) {
    if (error instanceof AuthorizationError) notFound();
    throw error;
  }

  const { project, membership } = access;
  const role = { role: membership.role };
  const canManageProject = can(role, Permission.PROJECT_MANAGE);
  const canManageMembers = can(role, Permission.PROJECT_MEMBERS_MANAGE);

  const { members } = await listProjectMembers(user.id, slug);

  let eligible: { userId: string; name: string; email: string }[] = [];
  if (canManageMembers) {
    const eligibleResult = await listEligibleMembers(user.id, slug);
    eligible = eligibleResult.eligible.map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.email,
    }));
  }

  return (
    <main className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <div className="w-full max-w-3xl space-y-8">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href="/projects" className="transition-colors hover:text-foreground">
            Projects
          </Link>
          <span aria-hidden="true"> / </span>
          <Link
            href={`/projects/${project.slug}`}
            className="transition-colors hover:text-foreground"
          >
            {project.slug}
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-foreground">Settings</span>
        </nav>

        <h1 className="text-2xl font-heading font-medium text-foreground">
          Project settings
        </h1>

        {canManageProject ? (
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>
                Edit the project&apos;s metadata, budget, currency, and status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectEditForm
                project={{
                  slug: project.slug,
                  name: project.name,
                  description: project.description,
                  budget: toMajorUnits(project.budgetMinorUnits),
                  currency: project.currency,
                  status: project.status,
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground">
                You do not have permission to edit this project&apos;s settings.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              {canManageMembers
                ? "Add or remove organization members from this project."
                : "People with access to this project."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectMembersManager
              slug={project.slug}
              canManage={canManageMembers}
              members={members.map((m) => ({
                userId: m.userId,
                name: m.name,
                email: m.email,
              }))}
              eligible={eligible}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
