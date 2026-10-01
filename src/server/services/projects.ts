import "server-only";

import { randomUUID } from "node:crypto";

import { AuthorizationError } from "@/server/guards/auth";
import { can, Permission } from "@/lib/permissions";
import {
  findOrganizationById,
  findOrganizationMembership,
  findOrganizationMembershipsForUser,
  findProjectsBySlugInOrganizations,
  findProjectMembership,
} from "@/server/repositories/tenancy";
import {
  createProject as repoCreateProject,
  updateProject as repoUpdateProject,
  listProjectsForActor,
  listProjectMembers as repoListProjectMembers,
  insertProjectMember,
  deleteProjectMember,
  listOrganizationMembers,
  findUserById,
} from "@/server/repositories/projects";
import {
  createProjectSchema,
  updateProjectSchema,
  toMinorUnits,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/validations/project";

/**
 * Phase 3 project orchestration.
 *
 * Services accept the authenticated actor's user id (derived from the
 * server session in the action layer) and enforce authorization through
 * the Phase 2 permission model. Client-supplied organization, project,
 * user, and role values are always re-resolved server-side.
 */

export class ProjectConflictError extends Error {
  constructor(
    message: string,
    public readonly code: string = "CONFLICT",
  ) {
    super(message);
    this.name = "ProjectConflictError";
  }
}

/** Resolves every organization the actor belongs to. */
async function organizationsOf(userId: string) {
  return findOrganizationMembershipsForUser(userId);
}

/**
 * Resolves a project by slug within the actor's organizations and enforces
 * organization membership + project membership + a permission.
 * Unknown slug and insufficient access both fail as "not found" so
 * existence is not leaked to unauthorized callers.
 */
async function requireProjectAccess(
  actorUserId: string,
  slug: string,
  permission: Permission,
) {
  const memberships = await organizationsOf(actorUserId);
  const organizationIds = memberships.map((m) => m.organizationId);

  const candidates = await findProjectsBySlugInOrganizations(
    organizationIds,
    slug,
  );
  for (const candidate of candidates) {
    const membership = memberships.find(
      (m) => m.organizationId === candidate.organizationId,
    );
    if (!membership) continue;
    if (!can({ role: membership.role }, permission)) continue;
    const projectMembership = await findProjectMembership(
      actorUserId,
      candidate.id,
    );
    if (!projectMembership) continue;

    return { project: candidate, membership, projectMembership };
  }

  throw new AuthorizationError("Project not found", "PROJECT_NOT_FOUND");
}

export async function listProjects(userId: string) {
  const memberships = await organizationsOf(userId);
  const organizationIds = memberships
    .filter((m) => can({ role: m.role }, Permission.PROJECT_READ))
    .map((m) => m.organizationId);

  return listProjectsForActor(userId, organizationIds);
}

export async function listManageableOrganizations(userId: string) {
  const memberships = await organizationsOf(userId);
  const manageable = [];
  for (const membership of memberships) {
    if (!can({ role: membership.role }, Permission.PROJECT_MANAGE)) continue;
    const org = await findOrganizationById(membership.organizationId);
    if (!org) continue;
    manageable.push({
      organizationId: org.id,
      name: org.name,
      slug: org.slug,
      role: membership.role,
    });
  }
  return manageable;
}

export async function getProject(userId: string, slug: string) {
  const access = await requireProjectAccess(userId, slug, Permission.PROJECT_READ);
  const creator = await findUserById(access.project.creatorId);
  return { ...access, creator };
}

export async function listProjectMembers(userId: string, projectSlug: string) {
  const access = await requireProjectAccess(
    userId,
    projectSlug,
    Permission.PROJECT_MEMBERS_READ,
  );
  const members = await repoListProjectMembers(access.project.id);
  return { access, members };
}

/** Organization members eligible to be added to the project. */
export async function listEligibleMembers(userId: string, projectSlug: string) {
  const access = await requireProjectAccess(
    userId,
    projectSlug,
    Permission.PROJECT_MEMBERS_MANAGE,
  );
  const [orgMembers, projectMembers] = await Promise.all([
    listOrganizationMembers(access.project.organizationId),
    repoListProjectMembers(access.project.id),
  ]);
  const memberIds = new Set(projectMembers.map((m) => m.userId));
  const eligible = orgMembers.filter((m) => !memberIds.has(m.userId));
  return { access, orgMembers, eligible };
}

export async function createProject(
  userId: string,
  input: CreateProjectInput,
) {
  const parsed = createProjectSchema.parse(input);

  const membership = await findOrganizationMembership(
    userId,
    parsed.organizationId,
  );
  if (!membership || !can({ role: membership.role }, Permission.PROJECT_MANAGE)) {
    throw new AuthorizationError(
      "Permission denied: cannot create projects in this organization",
      "PERMISSION_DENIED",
    );
  }

  const projectId = randomUUID();
  let record;
  try {
    record = await repoCreateProject({
      id: projectId,
      organizationId: parsed.organizationId,
      // The creator is always the authenticated actor — never client input.
      creatorId: userId,
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description || null,
      budgetMinorUnits: toMinorUnits(parsed.budget),
      currency: parsed.currency,
      status: parsed.status,
    });
  } catch (error) {
    if (isUniqueViolation(error, "project_org_slug_unique")) {
      throw new ProjectConflictError(
        "A project with this slug already exists in the organization.",
        "DUPLICATE_SLUG",
      );
    }
    throw error;
  }
  if (!record) throw new Error("Project insert returned no row");

  // The creator becomes a project member so access stays consistent.
  await insertProjectMember(randomUUID(), projectId, userId);

  return record;
}

export async function updateProject(
  userId: string,
  projectSlug: string,
  input: UpdateProjectInput,
) {
  const parsed = updateProjectSchema.parse(input);
  const access = await requireProjectAccess(
    userId,
    projectSlug,
    Permission.PROJECT_MANAGE,
  );

  try {
    const record = await repoUpdateProject(access.project.id, {
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description || null,
      budgetMinorUnits: toMinorUnits(parsed.budget),
      currency: parsed.currency,
      status: parsed.status,
    });
    if (!record) {
      throw new AuthorizationError("Project not found", "PROJECT_NOT_FOUND");
    }
    return record;
  } catch (error) {
    if (isUniqueViolation(error, "project_org_slug_unique")) {
      throw new ProjectConflictError(
        "A project with this slug already exists in the organization.",
        "DUPLICATE_SLUG",
      );
    }
    throw error;
  }
}

export async function addProjectMember(
  userId: string,
  projectSlug: string,
  targetUserId: string,
) {
  const access = await requireProjectAccess(
    userId,
    projectSlug,
    Permission.PROJECT_MEMBERS_MANAGE,
  );

  // The target must be a member of the owning organization.
  const targetMembership = await findOrganizationMembership(
    targetUserId,
    access.project.organizationId,
  );
  if (!targetMembership) {
    throw new AuthorizationError(
      "User is not a member of this organization",
      "NOT_ORGANIZATION_MEMBER",
    );
  }

  try {
    const membership = await insertProjectMember(
      randomUUID(),
      access.project.id,
      targetUserId,
    );
    if (!membership) {
      throw new ProjectConflictError(
        "User is already a member of this project",
        "ALREADY_MEMBER",
      );
    }
    return membership;
  } catch (error) {
    if (isUniqueViolation(error, "project_member_project_user_unique")) {
      throw new ProjectConflictError(
        "User is already a member of this project",
        "ALREADY_MEMBER",
      );
    }
    throw error;
  }
}

export async function removeProjectMember(
  userId: string,
  projectSlug: string,
  targetUserId: string,
) {
  const access = await requireProjectAccess(
    userId,
    projectSlug,
    Permission.PROJECT_MEMBERS_MANAGE,
  );

  const removed = await deleteProjectMember(access.project.id, targetUserId);
  if (!removed) {
    throw new AuthorizationError(
      "Project membership not found",
      "PROJECT_MEMBERSHIP_NOT_FOUND",
    );
  }
  return removed;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505" &&
    "constraint" in error &&
    (error as { constraint?: string }).constraint === constraint
  );
}
