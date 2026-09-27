import "server-only";

import { requireAuthenticatedUser, AuthorizationError } from "./auth";
import { findOrganizationMembership } from "@/server/repositories/tenancy";
import type { Role } from "@/db/schema";

export interface OrganizationContext {
  organizationId: string;
  membership: {
    id: string;
    role: Role;
    userId: string;
    organizationId: string;
  };
}

export async function requireOrganizationMembership(
  organizationId: string,
): Promise<OrganizationContext> {
  const { user } = await requireAuthenticatedUser();
  
  const membership = await findOrganizationMembership(user.id, organizationId);
  if (!membership) {
    throw new AuthorizationError(
      "Organization membership required",
      "ORGANIZATION_MEMBERSHIP_REQUIRED",
    );
  }
  
  return {
    organizationId,
    membership: {
      id: membership.id,
      role: membership.role,
      userId: membership.userId,
      organizationId: membership.organizationId,
    },
  };
}