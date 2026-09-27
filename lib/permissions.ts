/**
 * Permission catalog for Phase 2 (Tenancy + Authorization).
 * Only permissions required for organization/project authorization are included.
 * Finance, payment, withdrawal, approval, evidence, and audit permissions
 * are intentionally deferred to later phases.
 */
export const Permission = {
  // Organization permissions
  ORGANIZATION_READ: "organization.read",
  ORGANIZATION_MANAGE: "organization.manage",
  ORGANIZATION_MEMBERS_READ: "organization.members.read",
  ORGANIZATION_MEMBERS_MANAGE: "organization.members.manage",

  // Project permissions
  PROJECT_READ: "project.read",
  PROJECT_MANAGE: "project.manage",
  PROJECT_MEMBERS_READ: "project.members.read",
  PROJECT_MEMBERS_MANAGE: "project.members.manage",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export type Role = "OWNER" | "HEAD" | "MEMBER";

/**
 * Role hierarchy for permission resolution.
 * Higher roles inherit all permissions of lower roles.
 */
const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  OWNER: new Set([
    Permission.ORGANIZATION_READ,
    Permission.ORGANIZATION_MANAGE,
    Permission.ORGANIZATION_MEMBERS_READ,
    Permission.ORGANIZATION_MEMBERS_MANAGE,
    Permission.PROJECT_READ,
    Permission.PROJECT_MANAGE,
    Permission.PROJECT_MEMBERS_READ,
    Permission.PROJECT_MEMBERS_MANAGE,
  ]),
  HEAD: new Set([
    Permission.ORGANIZATION_READ,
    Permission.ORGANIZATION_MEMBERS_READ,
    Permission.PROJECT_READ,
    Permission.PROJECT_MANAGE,
    Permission.PROJECT_MEMBERS_READ,
    Permission.PROJECT_MEMBERS_MANAGE,
  ]),
  MEMBER: new Set([
    Permission.ORGANIZATION_READ,
    Permission.ORGANIZATION_MEMBERS_READ,
    Permission.PROJECT_READ,
    Permission.PROJECT_MEMBERS_READ,
  ]),
};

/**
 * Check if a role has a specific permission.
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Get all permissions for a role.
 */
export function getPermissionsForRole(role: Role): Set<Permission> {
  return new Set(ROLE_PERMISSIONS[role] ?? []);
}

/**
 * Check if a user's organization membership grants a permission.
 */
export function can(
  membership: { role: Role } | null | undefined,
  permission: Permission,
): boolean {
  if (!membership) return false;
  return roleHasPermission(membership.role, permission);
}

/**
 * Convenience helpers for common authorization checks.
 */
export const organizationPermissions = {
  canRead: (membership: { role: Role } | null | undefined) =>
    can(membership, Permission.ORGANIZATION_READ),
  canManage: (membership: { role: Role } | null | undefined) =>
    can(membership, Permission.ORGANIZATION_MANAGE),
  canReadMembers: (membership: { role: Role } | null | undefined) =>
    can(membership, Permission.ORGANIZATION_MEMBERS_READ),
  canManageMembers: (membership: { role: Role } | null | undefined) =>
    can(membership, Permission.ORGANIZATION_MEMBERS_MANAGE),
};

export const projectPermissions = {
  canRead: (membership: { role: Role } | null | undefined) =>
    can(membership, Permission.PROJECT_READ),
  canManage: (membership: { role: Role } | null | undefined) =>
    can(membership, Permission.PROJECT_MANAGE),
  canReadMembers: (membership: { role: Role } | null | undefined) =>
    can(membership, Permission.PROJECT_MEMBERS_READ),
  canManageMembers: (membership: { role: Role } | null | undefined) =>
    can(membership, Permission.PROJECT_MEMBERS_MANAGE),
};