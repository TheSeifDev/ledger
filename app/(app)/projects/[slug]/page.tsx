import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/server/session";
import { getProject, listProjectMembers } from "@/server/services/projects";
import { AuthorizationError } from "@/server/guards/auth";
import { can, Permission } from "@/lib/permissions";
import { formatMinorUnits } from "@/lib/finance/money";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PaymentForm } from "@/components/projects/PaymentForm";
import { WithdrawalForm } from "@/components/projects/WithdrawalForm";

export const dynamic = "force-dynamic";

function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug} · PHANTOMS Ledger`,
    description: "Project overview.",
  };
}

export default async function ProjectPage({
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

  const { project, membership, creator } = access;
  const { members } = await listProjectMembers(user.id, slug);
  const canManage = can({ role: membership.role }, Permission.PROJECT_MANAGE);

  return (
    <main className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <div className="w-full max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/projects" className="transition-colors hover:text-foreground">
              Projects
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-foreground">{project.slug}</span>
          </nav>
          {canManage ? (
            <Link
              href={`/projects/${project.slug}/settings`}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Settings
            </Link>
          ) : null}
        </div>

        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-medium text-foreground">
              {project.name}
            </h1>
            {project.description ? (
              <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
            ) : null}
          </div>
          <span
            className={
              project.status === "ACTIVE"
                ? "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                : "inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
            }
          >
            {project.status === "ACTIVE" ? "Active" : "Archived"}
          </span>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription>Budget</CardDescription>
              <CardTitle className="font-mono text-xl">
                {formatMinorUnits(project.budgetMinorUnits, project.currency)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Created by</CardDescription>
              <CardTitle className="text-base">
                {creator ? creator.name : "—"}
              </CardTitle>
              <CardDescription>{creator?.email}</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submit payment</CardTitle>
            <CardDescription>
              Record a payment to {project.name}. It will appear once a head
              or owner approves it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentForm projectSlug={project.slug} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request withdrawal</CardTitle>
            <CardDescription>
              Request a withdrawal from {project.name}. It has no effect until a
              head or owner approves it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WithdrawalForm projectSlug={project.slug} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              People with access to this project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">This project has no members yet.</p>
            ) : (
              <ul className="divide-y divide-border -my-3">
                {members.map((member) => (
                  <li key={member.userId} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    {member.userId === project.creatorId ? (
                      <span className="text-xs text-muted-foreground">Creator</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Timestamps</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="mt-0.5 text-foreground">{formatTimestamp(project.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last updated</dt>
                <dd className="mt-0.5 text-foreground">{formatTimestamp(project.updatedAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
