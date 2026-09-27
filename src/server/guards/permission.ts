import "server-only";

import { requireOrganizationMembership } from "./organization";
import { AuthorizationError } from "./auth";
import { requireProjectMembership } from "./project";
import { Permission, can } from "@/lib/permissions";
import type { OrganizationContext } from "./organization";
import type { ProjectContext } from "./project";

export interface PermissionContext {
  organization: OrganizationContext;
  project?: ProjectContext;
}

/**
 * Require a specific organization-level permission.
 */
export async function requireOrganizationPermission(
  organizationId: string,
  permission: Permission,
): Promise<OrganizationContext> {
  const context = await requireOrganizationMembership(organizationId);
  
  if (!can(context.membership, permission)) {
    throw new AuthorizationError(
      `Permission denied: ${permission}`,
      "PERMISSION_DENIED",
    );
  }
  
  return context;
}

/**
 * Require a specific project-level permission.
 * This also verifies organization membership and project membership.
 */
export async function requireProjectPermission(
  projectId: string,
  permission: Permission,
): Promise<ProjectContext> {
  const context = await requireProjectMembership(projectId);
  
  if (!can(context.organizationMembership, permission)) {
    throw new AuthorizationError(
      `Permission denied: ${permission}`,
      "PERMISSION_DENIED",
    );
  }
  
  return context;
}

/**
 * Check if the current user has a permission within an organization context.
 * Does not throw - returns boolean.
 */
export async function checkOrganizationPermission(
  organizationId: string,
  permission: Permission,
): Promise<boolean> {
  try {
    await requireOrganizationPermission(organizationId, permission);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the current user has a permission within a project context.
 * Does not throw - returns boolean.
 */
export async function checkProjectPermission(
  projectId: string,
  permission: Permission,
): Promise<boolean> {
  try {
    await requireProjectPermission(projectId, permission);
    return true;
  } catch {
    return false;
  }
}