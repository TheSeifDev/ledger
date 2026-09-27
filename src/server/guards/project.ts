import "server-only";

import { requireOrganizationMembership } from "./organization";
import { AuthorizationError } from "./auth";
import { findProjectById, findProjectMembership } from "@/server/repositories/tenancy";
import type { Role } from "@/db/schema";

export interface ProjectContext {
  projectId: string;
  organizationId: string;
  organizationMembership: {
    id: string;
    role: Role;
    userId: string;
    organizationId: string;
  };
  projectMembership: {
    id: string;
    userId: string;
    projectId: string;
  };
}

export async function requireProjectMembership(
  projectId: string,
): Promise<ProjectContext> {
  const project = await findProjectById(projectId);
  if (!project) {
    throw new AuthorizationError(
      "Project not found",
      "PROJECT_NOT_FOUND",
    );
  }
  
  const orgContext = await requireOrganizationMembership(project.organizationId);
  
  const projectMembership = await findProjectMembership(
    orgContext.membership.userId,
    projectId,
  );
  if (!projectMembership) {
    throw new AuthorizationError(
      "Project membership required",
      "PROJECT_MEMBERSHIP_REQUIRED",
    );
  }
  
  return {
    projectId,
    organizationId: project.organizationId,
    organizationMembership: orgContext.membership,
    projectMembership: {
      id: projectMembership.id,
      userId: projectMembership.userId,
      projectId: projectMembership.projectId,
    },
  };
}