// Phase 2: Tenancy + Authorization tests
//
// Tests the authorization foundation: organization membership, project membership,
// roles, permissions, cross-organization/project boundaries, and guard behavior.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/node-postgres";

import { parseServerEnv } from "../lib/validations/env.ts";
import { Permission, roleHasPermission, organizationPermissions, projectPermissions } from "../lib/permissions.ts";
import * as schema from "../src/db/schema/index.ts";
import {
  closePool,
  getPool,
} from "./helpers.ts";

const testEnv = parseServerEnv(process.env);

const pool = getPool();
const db = drizzle(pool, { schema });

// Each DB-backed suite owns a distinct fixture identity. Node's test
// runner executes the listed test files concurrently, so two suites
// sharing one user would delete each other's rows in resetFixture()
// mid-test — the other suite's session inserts would then violate the
// user foreign key.
const AUTHZ_FIXTURE = {
  email: "phase2-authz-test@ledger.test",
  password: "phase2-authz-password-2026",
  name: "Phase 2 AuthZ Test User",
} as const;

type Fixture = {
  userId: string;
  email: string;
  password: string;
  name: string;
};

type OrgFixture = Fixture & {
  organizationId: string;
  membershipId: string;
  role: "OWNER" | "HEAD" | "MEMBER";
};

type ProjectFixture = OrgFixture & {
  projectId: string;
  projectMembershipId: string;
};

const createdUserEmails = new Set<string>();

let authFixture: Fixture;

async function resetAll() {
  await pool.query(`delete from "session"`);
  await pool.query(`delete from "account"`);
  await pool.query(`delete from "project_member"`);
  await pool.query(`delete from "organization_member"`);
  await pool.query(`delete from "project"`);
  await pool.query(`delete from "organization"`);
  // Clean up users created by this test suite
  for (const email of createdUserEmails) {
    await pool.query(`delete from "user" where email = $1`, [email]);
  }
  createdUserEmails.clear();
}

async function provisionUser(spec: { email: string; password: string; name: string }): Promise<Fixture> {
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(spec.password);

  const { rows } = await pool.query(
    `insert into "user" (id, name, email)
     values ($1, $2, $3)
     on conflict (email) do update set name = excluded.name, updated_at = now()
     returning id`,
    [randomUUID(), spec.name, spec.email],
  );
  const userId = rows[0].id;

  await pool.query(
    `insert into "account" (id, user_id, account_id, provider_id, password)
     values ($1, $2, $2, 'credential', $3)
     on conflict (provider_id, account_id) do update set password = excluded.password, updated_at = now()`,
    [randomUUID(), userId, hash],
  );

  createdUserEmails.add(spec.email);
  return { userId, email: spec.email, password: spec.password, name: spec.name };
}

async function provisionOrganization(
  userId: string,
  role: "OWNER" | "HEAD" | "MEMBER" = "MEMBER",
): Promise<{ organizationId: string; membershipId: string }> {
  const organizationId = randomUUID();
  const membershipId = randomUUID();
  
  await pool.query(
    `insert into "organization" (id, name, slug)
     values ($1, $2, $3)`,
    [organizationId, `Org ${organizationId.slice(0, 8)}`, `org-${organizationId.slice(0, 8)}`],
  );
  
  await pool.query(
    `insert into "organization_member" (id, organization_id, user_id, role)
     values ($1, $2, $3, $4)`,
    [membershipId, organizationId, userId, role],
  );
  
  return { organizationId, membershipId };
}

async function provisionProject(
  organizationId: string,
  userId: string,
): Promise<{ projectId: string; projectMembershipId: string }> {
  const projectId = randomUUID();
  const projectMembershipId = randomUUID();
  
  await pool.query(
    `insert into "project" (id, organization_id, name, slug)
     values ($1, $2, $3, $4)`,
    [projectId, organizationId, `Project ${projectId.slice(0, 8)}`, `proj-${projectId.slice(0, 8)}`],
  );
  
  await pool.query(
    `insert into "project_member" (id, project_id, user_id)
     values ($1, $2, $3)`,
    [projectMembershipId, projectId, userId],
  );
  
  return { projectId, projectMembershipId };
}

async function findOrganizationMembership(userId: string, organizationId: string) {
  const { rows } = await pool.query(
    `select * from "organization_member" where user_id = $1 and organization_id = $2`,
    [userId, organizationId],
  );
  return rows[0] ?? null;
}

async function findProjectMembership(userId: string, projectId: string) {
  const { rows } = await pool.query(
    `select * from "project_member" where user_id = $1 and project_id = $2`,
    [userId, projectId],
  );
  return rows[0] ?? null;
}

async function findProjectById(projectId: string) {
  const { rows } = await pool.query(
    `select * from "project" where id = $1`,
    [projectId],
  );
  return rows[0] ?? null;
}

class AuthorizationError extends Error {
  public readonly code: string;
  
  constructor(message: string, code: string = "FORBIDDEN") {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

async function requireOrganizationMembership(
  userId: string,
  organizationId: string,
) {
  const membership = await findOrganizationMembership(userId, organizationId);
  if (!membership) {
    throw new AuthorizationError(
      "Organization membership required",
      "ORGANIZATION_MEMBERSHIP_REQUIRED",
    );
  }
  return membership;
}

async function requireProjectMembership(
  userId: string,
  projectId: string,
) {
  const project = await findProjectById(projectId);
  if (!project) {
    throw new AuthorizationError("Project not found", "PROJECT_NOT_FOUND");
  }
  
  const orgMembership = await requireOrganizationMembership(userId, project.organization_id);
  
  const projectMembership = await findProjectMembership(userId, projectId);
  if (!projectMembership) {
    throw new AuthorizationError(
      "Project membership required",
      "PROJECT_MEMBERSHIP_REQUIRED",
    );
  }
  
  return { project, orgMembership, projectMembership };
}

async function requireOrganizationPermission(
  userId: string,
  organizationId: string,
  permission: Permission,
) {
  const membership = await requireOrganizationMembership(userId, organizationId);
  if (!roleHasPermission(membership.role as "OWNER" | "HEAD" | "MEMBER", permission)) {
    throw new AuthorizationError(`Permission denied: ${permission}`, "PERMISSION_DENIED");
  }
  return membership;
}

async function requireProjectPermission(
  userId: string,
  projectId: string,
  permission: Permission,
) {
  const { orgMembership } = await requireProjectMembership(userId, projectId);
  if (!roleHasPermission(orgMembership.role as "OWNER" | "HEAD" | "MEMBER", permission)) {
    throw new AuthorizationError(`Permission denied: ${permission}`, "PERMISSION_DENIED");
  }
  return orgMembership;
}

async function checkOrganizationPermission(
  userId: string,
  organizationId: string,
  permission: Permission,
): Promise<boolean> {
  try {
    await requireOrganizationPermission(userId, organizationId, permission);
    return true;
  } catch {
    return false;
  }
}

async function checkProjectPermission(
  userId: string,
  projectId: string,
  permission: Permission,
): Promise<boolean> {
  try {
    await requireProjectPermission(userId, projectId, permission);
    return true;
  } catch {
    return false;
  }
}

before(async () => {
  await resetAll();
  
  authFixture = await provisionUser({
    email: AUTHZ_FIXTURE.email,
    password: AUTHZ_FIXTURE.password,
    name: AUTHZ_FIXTURE.name,
  });
});

after(async () => {
  await resetAll();
  await closePool();
});

describe("permission catalog", () => {
  it("defines all Phase 2 permissions", () => {
    const permissions = Object.values(Permission);
    assert.equal(permissions.length, 8);
    
    assert.ok(permissions.includes("organization.read"));
    assert.ok(permissions.includes("organization.manage"));
    assert.ok(permissions.includes("organization.members.read"));
    assert.ok(permissions.includes("organization.members.manage"));
    assert.ok(permissions.includes("project.read"));
    assert.ok(permissions.includes("project.manage"));
    assert.ok(permissions.includes("project.members.read"));
    assert.ok(permissions.includes("project.members.manage"));
  });
});

describe("role permissions", () => {
  it("OWNER has all permissions", () => {
    const permissions = Object.values(Permission);
    for (const perm of permissions) {
      assert.ok(roleHasPermission("OWNER", perm), `OWNER should have ${perm}`);
    }
  });

  it("HEAD has management permissions but not organization.manage or organization.members.manage", () => {
    assert.ok(roleHasPermission("HEAD", "organization.read"));
    assert.ok(!roleHasPermission("HEAD", "organization.manage"));
    assert.ok(roleHasPermission("HEAD", "organization.members.read"));
    assert.ok(!roleHasPermission("HEAD", "organization.members.manage"));
    assert.ok(roleHasPermission("HEAD", "project.read"));
    assert.ok(roleHasPermission("HEAD", "project.manage"));
    assert.ok(roleHasPermission("HEAD", "project.members.read"));
    assert.ok(roleHasPermission("HEAD", "project.members.manage"));
  });

  it("MEMBER has read-only permissions", () => {
    assert.ok(roleHasPermission("MEMBER", "organization.read"));
    assert.ok(!roleHasPermission("MEMBER", "organization.manage"));
    assert.ok(roleHasPermission("MEMBER", "organization.members.read"));
    assert.ok(!roleHasPermission("MEMBER", "organization.members.manage"));
    assert.ok(roleHasPermission("MEMBER", "project.read"));
    assert.ok(!roleHasPermission("MEMBER", "project.manage"));
    assert.ok(roleHasPermission("MEMBER", "project.members.read"));
    assert.ok(!roleHasPermission("MEMBER", "project.members.manage"));
  });
});

describe("permission helpers", () => {
  it("organizationPermissions.canRead returns true for all roles", () => {
    assert.ok(organizationPermissions.canRead({ role: "OWNER" }));
    assert.ok(organizationPermissions.canRead({ role: "HEAD" }));
    assert.ok(organizationPermissions.canRead({ role: "MEMBER" }));
  });

  it("organizationPermissions.canManage returns true only for OWNER", () => {
    assert.ok(organizationPermissions.canManage({ role: "OWNER" }));
    assert.ok(!organizationPermissions.canManage({ role: "HEAD" }));
    assert.ok(!organizationPermissions.canManage({ role: "MEMBER" }));
  });

  it("organizationPermissions.canManageMembers returns true only for OWNER", () => {
    assert.ok(organizationPermissions.canManageMembers({ role: "OWNER" }));
    assert.ok(!organizationPermissions.canManageMembers({ role: "HEAD" }));
    assert.ok(!organizationPermissions.canManageMembers({ role: "MEMBER" }));
  });

  it("projectPermissions.canManage returns true for OWNER and HEAD", () => {
    assert.ok(projectPermissions.canManage({ role: "OWNER" }));
    assert.ok(projectPermissions.canManage({ role: "HEAD" }));
    assert.ok(!projectPermissions.canManage({ role: "MEMBER" }));
  });

  it("returns false for null membership", () => {
    assert.ok(!organizationPermissions.canRead(null));
    assert.ok(!organizationPermissions.canManage(null));
    assert.ok(!projectPermissions.canRead(null));
    assert.ok(!projectPermissions.canManage(null));
  });
});

describe("organization membership", () => {
  let orgFixture: OrgFixture;
  let otherUser: Fixture;

  before(async () => {
    const user = await provisionUser({
      email: "phase2-org-owner@ledger.test",
      password: "password-123",
      name: "Org Owner",
    });
    const { organizationId, membershipId } = await provisionOrganization(user.userId, "OWNER");
    orgFixture = { ...user, organizationId, membershipId, role: "OWNER" };

    const member = await provisionUser({
      email: "phase2-org-member@ledger.test",
      password: "password-123",
      name: "Org Member",
    });
    await provisionOrganization(member.userId, "MEMBER");
    await pool.query(`update "organization_member" set organization_id = $1 where user_id = $2`, [orgFixture.organizationId, member.userId]);
    
    otherUser = await provisionUser({
      email: "phase2-other-user@ledger.test",
      password: "password-123",
      name: "Other User",
    });
    await provisionOrganization(otherUser.userId, "OWNER");
  });

  it("valid member → allowed", async () => {
    const membership = await findOrganizationMembership(orgFixture.userId, orgFixture.organizationId);
    assert.ok(membership);
    assert.equal(membership.role, "OWNER");
  });

  it("no membership → denied (returns null)", async () => {
    const membership = await findOrganizationMembership(otherUser.userId, orgFixture.organizationId);
    assert.equal(membership, null);
  });

  it("duplicate membership → DB constraint failure", async () => {
    await assert.rejects(
      pool.query(
        `insert into "organization_member" (id, organization_id, user_id, role)
         values ($1, $2, $3, $4)`,
        [randomUUID(), orgFixture.organizationId, orgFixture.userId, "MEMBER"],
      ),
      /duplicate key value violates unique constraint/,
    );
  });
});

describe("cross-organization", () => {
  let orgAFixture: OrgFixture;
  let orgBFixture: OrgFixture;

  before(async () => {
    const userA = await provisionUser({
      email: "phase2-cross-org-a@ledger.test",
      password: "password-123",
      name: "User A",
    });
    const { organizationId: orgAId, membershipId: memAId } = await provisionOrganization(userA.userId, "OWNER");
    orgAFixture = { ...userA, organizationId: orgAId, membershipId: memAId, role: "OWNER" };

    const userB = await provisionUser({
      email: "phase2-cross-org-b@ledger.test",
      password: "password-123",
      name: "User B",
    });
    const { organizationId: orgBId, membershipId: memBId } = await provisionOrganization(userB.userId, "OWNER");
    orgBFixture = { ...userB, organizationId: orgBId, membershipId: memBId, role: "OWNER" };
  });

  it("user in org A + org A resource → allowed", async () => {
    const membership = await findOrganizationMembership(orgAFixture.userId, orgAFixture.organizationId);
    assert.ok(membership);
    assert.equal(membership.organization_id, orgAFixture.organizationId);
  });

  it("user in org A + org B resource → denied", async () => {
    const membership = await findOrganizationMembership(orgAFixture.userId, orgBFixture.organizationId);
    assert.equal(membership, null);
  });

  it("changing organization_id client-side does not grant access", async () => {
    const membership = await findOrganizationMembership(orgAFixture.userId, orgBFixture.organizationId);
    assert.equal(membership, null, "Client-provided org B ID must not grant access");
  });
});

describe("cross-project", () => {
  let orgFixture: OrgFixture;
  let projectAFixture: ProjectFixture;
  let projectBFixture: ProjectFixture;
  let otherUser: Fixture;

  before(async () => {
    const user = await provisionUser({
      email: "phase2-cross-proj@ledger.test",
      password: "password-123",
      name: "Cross Project User",
    });
    const { organizationId, membershipId } = await provisionOrganization(user.userId, "OWNER");
    orgFixture = { ...user, organizationId, membershipId, role: "OWNER" };

    const { projectId: projAId, projectMembershipId: pmAId } = await provisionProject(orgFixture.organizationId, orgFixture.userId);
    projectAFixture = { ...orgFixture, projectId: projAId, projectMembershipId: pmAId };

    const { projectId: projBId, projectMembershipId: pmBId } = await provisionProject(orgFixture.organizationId, orgFixture.userId);
    projectBFixture = { ...orgFixture, projectId: projBId, projectMembershipId: pmBId };

    otherUser = await provisionUser({
      email: "phase2-other-proj-user@ledger.test",
      password: "password-123",
      name: "Other Project User",
    });
    await provisionOrganization(otherUser.userId, "MEMBER");
    await pool.query(`update "organization_member" set organization_id = $1 where user_id = $2`, [orgFixture.organizationId, otherUser.userId]);
    await provisionProject(orgFixture.organizationId, otherUser.userId);
    await pool.query(`update "project_member" set project_id = $1 where user_id = $2`, [projectBFixture.projectId, otherUser.userId]);
  });

  it("member of project A + project A → allowed", async () => {
    const membership = await findProjectMembership(projectAFixture.userId, projectAFixture.projectId);
    assert.ok(membership);
    assert.equal(membership.project_id, projectAFixture.projectId);
  });

  it("member of project A + project B → allowed (same user is member of both)", async () => {
    const membership = await findProjectMembership(projectAFixture.userId, projectBFixture.projectId);
    assert.ok(membership);
    assert.equal(membership.project_id, projectBFixture.projectId);
  });

  it("other user in project B only + project A → denied", async () => {
    const membership = await findProjectMembership(otherUser.userId, projectAFixture.projectId);
    assert.equal(membership, null);
  });

  it("changing project_id client-side does not grant access for other user", async () => {
    const membership = await findProjectMembership(otherUser.userId, projectAFixture.projectId);
    assert.equal(membership, null, "Client-provided project A ID must not grant access to other user");
  });
});

describe("organization/project consistency", () => {
  let orgAFixture: OrgFixture;
  let orgBFixture: OrgFixture;
  let projectInOrgA: ProjectFixture;

  before(async () => {
    const userA = await provisionUser({
      email: "phase2-consistency-a@ledger.test",
      password: "password-123",
      name: "User A",
    });
    const { organizationId: orgAId, membershipId: memAId } = await provisionOrganization(userA.userId, "OWNER");
    orgAFixture = { ...userA, organizationId: orgAId, membershipId: memAId, role: "OWNER" };

    const { projectId: projAId, projectMembershipId: pmAId } = await provisionProject(orgAFixture.organizationId, orgAFixture.userId);
    projectInOrgA = { ...orgAFixture, projectId: projAId, projectMembershipId: pmAId };

    const userB = await provisionUser({
      email: "phase2-consistency-b@ledger.test",
      password: "password-123",
      name: "User B",
    });
    const { organizationId: orgBId, membershipId: memBId } = await provisionOrganization(userB.userId, "OWNER");
    orgBFixture = { ...userB, organizationId: orgBId, membershipId: memBId, role: "OWNER" };
  });

  it("project belongs to org A, user resolved in org B → denied", async () => {
    const project = await findProjectById(projectInOrgA.projectId);
    assert.ok(project);
    assert.equal(project.organization_id, orgAFixture.organizationId);
    
    const membership = await findProjectMembership(orgBFixture.userId, projectInOrgA.projectId);
    assert.equal(membership, null, "Cross-organization project access must be denied");
  });
});

describe("guard behavior", () => {
  let orgFixture: OrgFixture;
  let projectFixture: ProjectFixture;

  before(async () => {
    const user = await provisionUser({
      email: "phase2-guard-test@ledger.test",
      password: "password-123",
      name: "Guard Test User",
    });
    const { organizationId, membershipId } = await provisionOrganization(user.userId, "OWNER");
    orgFixture = { ...user, organizationId, membershipId, role: "OWNER" };

    const { projectId, projectMembershipId } = await provisionProject(orgFixture.organizationId, orgFixture.userId);
    projectFixture = { ...orgFixture, projectId, projectMembershipId };
  });

  it("AuthorizationError class exists with correct code", () => {
    const error = new AuthorizationError("test");
    assert.ok(error instanceof Error);
    assert.equal(error.code, "FORBIDDEN");
  });

  it("session but no organization membership → throws ORGANIZATION_MEMBERSHIP_REQUIRED", async () => {
    const otherUser = await provisionUser({
      email: "phase2-no-membership@ledger.test",
      password: "password-123",
      name: "No Membership User",
    });
    
    const membership = await findOrganizationMembership(otherUser.userId, orgFixture.organizationId);
    assert.equal(membership, null);
  });

  it("membership but insufficient permission → denied", async () => {
    const memberUser = await provisionUser({
      email: "phase2-member-perm@ledger.test",
      password: "password-123",
      name: "Member User",
    });
    await provisionOrganization(memberUser.userId, "MEMBER");
    await pool.query(`update "organization_member" set organization_id = $1 where user_id = $2`, [orgFixture.organizationId, memberUser.userId]);
    
    const canManage = await checkOrganizationPermission(memberUser.userId, orgFixture.organizationId, "organization.manage");
    assert.ok(!canManage);
    
    const canManageMembers = await checkOrganizationPermission(memberUser.userId, orgFixture.organizationId, "organization.members.manage");
    assert.ok(!canManageMembers);
    
    const canRead = await checkOrganizationPermission(memberUser.userId, orgFixture.organizationId, "organization.read");
    assert.ok(canRead);
    
    const canReadMembers = await checkOrganizationPermission(memberUser.userId, orgFixture.organizationId, "organization.members.read");
    assert.ok(canReadMembers);
  });

  it("valid membership + valid permission → allowed", async () => {
    const canManage = await checkOrganizationPermission(orgFixture.userId, orgFixture.organizationId, "organization.manage");
    assert.ok(canManage);
    
    const canManageMembers = await checkOrganizationPermission(orgFixture.userId, orgFixture.organizationId, "organization.members.manage");
    assert.ok(canManageMembers);
    
    const canManageProject = await checkProjectPermission(orgFixture.userId, projectFixture.projectId, "project.manage");
    assert.ok(canManageProject);
  });
});

describe("database constraints", () => {
  it("organization slug is unique", async () => {
    const orgId1 = randomUUID();
    const orgId2 = randomUUID();
    const slug = "unique-slug-test";
    
    await pool.query(
      `insert into "organization" (id, name, slug) values ($1, $2, $3)`,
      [orgId1, "Org 1", slug],
    );
    
    await assert.rejects(
      pool.query(
        `insert into "organization" (id, name, slug) values ($1, $2, $3)`,
        [orgId2, "Org 2", slug],
      ),
      /duplicate key value violates unique constraint.*organization_slug_unique/,
    );
  });

  it("organization_member organization_id + user_id is unique", async () => {
    const user = await provisionUser({
      email: "phase2-unique-mem@ledger.test",
      password: "password-123",
      name: "Unique Member",
    });
    const { organizationId } = await provisionOrganization(user.userId, "MEMBER");
    
    await assert.rejects(
      pool.query(
        `insert into "organization_member" (id, organization_id, user_id, role)
         values ($1, $2, $3, $4)`,
        [randomUUID(), organizationId, user.userId, "HEAD"],
      ),
      /duplicate key value violates unique constraint.*organization_member_org_user_unique/,
    );
  });

  it("project org_id + slug is unique", async () => {
    const user = await provisionUser({
      email: "phase2-unique-proj@ledger.test",
      password: "password-123",
      name: "Unique Project",
    });
    const { organizationId } = await provisionOrganization(user.userId, "OWNER");
    const projectId1 = randomUUID();
    const projectId2 = randomUUID();
    const slug = "unique-project-slug";
    
    await pool.query(
      `insert into "project" (id, organization_id, name, slug) values ($1, $2, $3, $4)`,
      [projectId1, organizationId, "Project 1", slug],
    );
    
    await assert.rejects(
      pool.query(
        `insert into "project" (id, organization_id, name, slug) values ($1, $2, $3, $4)`,
        [projectId2, organizationId, "Project 2", slug],
      ),
      /duplicate key value violates unique constraint.*project_org_slug_unique/,
    );
  });

  it("project_member project_id + user_id is unique", async () => {
    const user = await provisionUser({
      email: "phase2-unique-pm@ledger.test",
      password: "password-123",
      name: "Unique PM",
    });
    const { organizationId } = await provisionOrganization(user.userId, "OWNER");
    const { projectId } = await provisionProject(organizationId, user.userId);
    
    await assert.rejects(
      pool.query(
        `insert into "project_member" (id, project_id, user_id)
         values ($1, $2, $3)`,
        [randomUUID(), projectId, user.userId],
      ),
      /duplicate key value violates unique constraint.*project_member_project_user_unique/,
    );
  });

  it("role enum only allows OWNER, HEAD, MEMBER", async () => {
    const user = await provisionUser({
      email: "phase2-role-enum@ledger.test",
      password: "password-123",
      name: "Role Enum Test",
    });
    const { organizationId } = await provisionOrganization(user.userId, "OWNER");
    
    await assert.rejects(
      pool.query(
        `insert into "organization_member" (id, organization_id, user_id, role)
         values ($1, $2, $3, $4)`,
        [randomUUID(), organizationId, user.userId, "INVALID_ROLE"],
      ),
      /invalid input value for enum.*role/,
    );
  });
});

describe("Phase 1 regression", () => {
  it("login still works", async () => {
    const auth = betterAuth({
      database: drizzleAdapter(db, { provider: "pg", schema }),
      secret: testEnv.BETTER_AUTH_SECRET,
      baseURL: testEnv.BETTER_AUTH_URL,
      emailAndPassword: { enabled: true, disableSignUp: true },
    });

    const response = await auth.api.signInEmail({
      body: { email: authFixture.email, password: authFixture.password },
      asResponse: true,
    });
    
    const raw = await response.text();
    assert.equal(response.status, 200, raw);
    
    const cookie = response.headers.getSetCookie()
      .filter((c) => c.startsWith("better-auth.session_token="))
      .map((c) => c.split(";")[0])
      .join("; ");
    
    const body = JSON.parse(raw) as { token: string };
    assert.ok(cookie);
    assert.ok(body.token);
    
    const session = await auth.api.getSession({ headers: { cookie } });
    assert.ok(session);
    assert.equal(session.user.id, authFixture.userId);
  });

  it("logout still invalidates session", async () => {
    const auth = betterAuth({
      database: drizzleAdapter(db, { provider: "pg", schema }),
      secret: testEnv.BETTER_AUTH_SECRET,
      baseURL: testEnv.BETTER_AUTH_URL,
      emailAndPassword: { enabled: true, disableSignUp: true },
    });

    const response = await auth.api.signInEmail({
      body: { email: authFixture.email, password: authFixture.password },
      asResponse: true,
    });
    
    const raw = await response.text();
    const cookie = response.headers.getSetCookie()
      .filter((c) => c.startsWith("better-auth.session_token="))
      .map((c) => c.split(";")[0])
      .join("; ");
    const body = JSON.parse(raw) as { token: string };
    
    let session = await auth.api.getSession({ headers: { cookie } });
    assert.ok(session);
    
    await auth.api.signOut({ headers: { cookie } });
    
    const { rows } = await pool.query(
      `select count(*)::int as count from "session" where token = $1`,
      [body.token],
    );
    assert.equal(rows[0].count, 0);
    
    session = await auth.api.getSession({ headers: { cookie } });
    assert.equal(session, null);
  });

  it("no public sign-up", async () => {
    const auth = betterAuth({
      database: drizzleAdapter(db, { provider: "pg", schema }),
      secret: testEnv.BETTER_AUTH_SECRET,
      baseURL: testEnv.BETTER_AUTH_URL,
      emailAndPassword: { enabled: true, disableSignUp: true },
    });

    await assert.rejects(
      auth.api.signUpEmail({
        body: {
          email: "phase2-no-signup@ledger.test",
          password: "password",
          name: "Rejected",
        },
      }),
      (error: { statusCode?: number; body?: { code?: string } }) =>
        error.statusCode === 400 && error.body?.code === "EMAIL_PASSWORD_SIGN_UP_DISABLED",
    );
  });
});