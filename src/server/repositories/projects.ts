import "server-only";

import { db } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  organization,
  organizationMember,
  project,
  projectMember,
  user,
} from "@/db/schema";
import type { ProjectStatus } from "@/db/schema/tenancy";

/**
 * Phase 3 project data access.
 *
 * The service layer always passes an organization- or membership-scope;
 * nothing here exposes unrestricted global reads to callers.
 */

export async function createProject(input: {
  id: string;
  organizationId: string;
  creatorId: string;
  name: string;
  slug: string;
  description: string | null;
  budgetMinorUnits: bigint;
  currency: string;
  status: ProjectStatus;
}) {
  const [created] = await db
    .insert(project)
    .values({
      id: input.id,
      organizationId: input.organizationId,
      creatorId: input.creatorId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      budgetMinorUnits: input.budgetMinorUnits,
      currency: input.currency,
      status: input.status,
    })
    .returning();
  return created ?? null;
}

export async function updateProject(
  projectId: string,
  input: {
    name: string;
    slug: string;
    description: string | null;
    budgetMinorUnits: bigint;
    currency: string;
    status: ProjectStatus;
  },
) {
  const [updated] = await db
    .update(project)
    .set({
      name: input.name,
      slug: input.slug,
      description: input.description,
      budgetMinorUnits: input.budgetMinorUnits,
      currency: input.currency,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(project.id, projectId))
    .returning();
  return updated ?? null;
}

/** Projects the actor is a member of within the given organizations. */
export async function listProjectsForActor(
  userId: string,
  organizationIds: string[],
) {
  if (organizationIds.length === 0) return [];

  return db
    .select({
      id: project.id,
      organizationId: project.organizationId,
      name: project.name,
      slug: project.slug,
      description: project.description,
      budgetMinorUnits: project.budgetMinorUnits,
      currency: project.currency,
      status: project.status,
      creatorId: project.creatorId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      organizationRole: organizationMember.role,
    })
    .from(projectMember)
    .innerJoin(project, eq(projectMember.projectId, project.id))
    .innerJoin(organization, eq(project.organizationId, organization.id))
    .innerJoin(
      organizationMember,
      and(
        eq(organizationMember.organizationId, project.organizationId),
        eq(organizationMember.userId, userId),
      ),
    )
    .where(
      and(
        eq(projectMember.userId, userId),
        inArray(project.organizationId, organizationIds),
      ),
    )
    .orderBy(project.createdAt);
}

export async function listProjectMembers(projectId: string) {
  return db
    .select({
      membershipId: projectMember.id,
      projectId: projectMember.projectId,
      userId: user.id,
      name: user.name,
      email: user.email,
      createdAt: projectMember.createdAt,
    })
    .from(projectMember)
    .innerJoin(user, eq(projectMember.userId, user.id))
    .where(eq(projectMember.projectId, projectId))
    .orderBy(projectMember.createdAt);
}

export async function insertProjectMember(
  id: string,
  projectId: string,
  userId: string,
) {
  const [membership] = await db
    .insert(projectMember)
    .values({ id, projectId, userId })
    .returning();
  return membership ?? null;
}

export async function deleteProjectMember(projectId: string, userId: string) {
  const [removed] = await db
    .delete(projectMember)
    .where(
      and(
        eq(projectMember.projectId, projectId),
        eq(projectMember.userId, userId),
      ),
    )
    .returning({ id: projectMember.id });
  return removed ?? null;
}

export async function listOrganizationMembers(organizationId: string) {
  return db
    .select({
      membershipId: organizationMember.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: organizationMember.role,
    })
    .from(organizationMember)
    .innerJoin(user, eq(organizationMember.userId, user.id))
    .where(eq(organizationMember.organizationId, organizationId))
    .orderBy(user.name);
}

export async function findUserById(userId: string) {
  return db.query.user.findFirst({
    where: eq(user.id, userId),
  });
}
