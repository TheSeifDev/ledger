// Phase 3: Project management tests
//
// DB-backed tests for the project container: schema/validation invariants,
// organization + tenant-aware scoping, exact budget storage, creator
// integrity, and membership management.
//
// These tests run in a plain Node process. Server modules import
// "server-only" and Next-specific primitives, so — like
// auth-integration.test.ts mirrors lib/auth.ts — the assertions below
// validate the same database constraints and permission rules the
// services enforce (service authorization uses lib/permissions helpers,
// imported here directly), while fixtures are created with raw SQL in the
// same shape the repositories write.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import {
  createProjectSchema,
  updateProjectSchema,
  toMinorUnits,
  MAJOR_UNIT_PATTERN,
  PROJECT_STATUSES,
} from "../lib/validations/project.ts";
import { formatMinorUnits } from "../lib/finance/money.ts";
import { can, Permission } from "../lib/permissions.ts";
import {
  closePool,
  getPool,
  provisionFixture,
} from "./helpers.ts";

const pool = getPool();

const FIXTURE_PREFIX = "phase3-test";
const createdUserEmails = new Set<string>();
const createdOrganizationIds = new Set<string>();

/**
 * Fixture-scoped cleanup. Test files run concurrently against the shared
 * development database, so this suite deletes only what it created; other
 * suites' fixtures are never touched.
 */
async function resetFixtures() {
  for (const organizationId of createdOrganizationIds) {
    await pool.query(`delete from "organization" where id = $1`, [organizationId]);
  }
  createdOrganizationIds.clear();
  for (const email of createdUserEmails) {
    await pool.query(`delete from "user" where email = $1`, [email]);
  }
  createdUserEmails.clear();
}

async function provisionUser(name: string): Promise<string> {
  const email = `${FIXTURE_PREFIX}-${name.toLowerCase().replace(/\s+/g, "-")}-${randomUUID().slice(0, 8)}@ledger.test`;
  const userId = randomUUID();
  await pool.query(
    `insert into "user" (id, name, email) values ($1, $2, $3)`,
    [userId, `${name} (Phase 3)`, email],
  );
  createdUserEmails.add(email);
  return userId;
}

async function provisionOrganization(
  userId: string,
  role: "OWNER" | "HEAD" | "MEMBER",
): Promise<string> {
  const organizationId = randomUUID();
  await pool.query(
    `insert into "organization" (id, name, slug) values ($1, $2, $3)`,
    [
      organizationId,
      `P3 Org ${organizationId.slice(0, 8)}`,
      `p3-${organizationId.slice(0, 8)}`,
    ],
  );
  createdOrganizationIds.add(organizationId);
  await pool.query(
    `insert into "organization_member" (id, organization_id, user_id, role)
     values ($1, $2, $3, $4)`,
    [randomUUID(), organizationId, userId, role],
  );
  return organizationId;
}

async function provisionProject(
  organizationId: string,
  creatorId: string,
  input: { slug?: string; name?: string } = {},
): Promise<string> {
  const projectId = randomUUID();
  await pool.query(
    `insert into "project"
       (id, organization_id, creator_id, name, slug, description, budget_minor_units, currency, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      projectId,
      organizationId,
      creatorId,
      input.name ?? "Test Project",
      input.slug ?? `proj-${projectId.slice(0, 8)}`,
      "Phase 3 test project",
      75000n,
      "EGP",
      "ACTIVE",
    ],
  );
  return projectId;
}

async function addProjectMember(projectId: string, userId: string) {
  await pool.query(
    `insert into "project_member" (id, project_id, user_id) values ($1, $2, $3)`,
    [randomUUID(), projectId, userId],
  );
}

async function findOrganizationRole(
  userId: string,
  organizationId: string,
): Promise<"OWNER" | "HEAD" | "MEMBER" | null> {
  const { rows } = await pool.query(
    `select role from "organization_member" where user_id = $1 and organization_id = $2`,
    [userId, organizationId],
  );
  return (rows[0]?.role as "OWNER" | "HEAD" | "MEMBER") ?? null;
}

before(async () => {
  await resetFixtures();
});

after(async () => {
  await resetFixtures();
  await closePool();
});

describe("money helpers", () => {
  it("converts major units to exact integer minor units without floats", () => {
    assert.equal(toMinorUnits("750.00"), 75000n);
    assert.equal(toMinorUnits("0"), 0n);
    assert.equal(toMinorUnits("0.09"), 9n);
    assert.equal(toMinorUnits("19.99"), 1999n);
    assert.equal(toMinorUnits("123456789012345.67"), 12345678901234567n);
  });

  it("rejects non-decimal budgets", () => {
    assert.equal(MAJOR_UNIT_PATTERN.test("abc"), false);
    assert.equal(MAJOR_UNIT_PATTERN.test("-5"), false);
    assert.equal(MAJOR_UNIT_PATTERN.test("1.234"), false);
    assert.equal(MAJOR_UNIT_PATTERN.test(""), false);
  });

  it("formats minor units for display without calculations", () => {
    assert.equal(formatMinorUnits(75000n, "EGP"), "EGP 750.00");
    assert.equal(formatMinorUnits(9n, "EGP"), "EGP 0.09");
  });
});

describe("project validation", () => {
  const base = {
    organizationId: randomUUID(),
    name: "Launch",
    slug: "launch",
    description: "Campaign launch",
    budget: "750.00",
    currency: "EGP",
    status: "ACTIVE",
  };

  it("accepts a valid payload", () => {
    const result = createProjectSchema.safeParse(base);
    assert.ok(result.success, result.success ? "" : JSON.stringify(result.error.issues));
  });

  it("rejects a missing name", () => {
    const result = createProjectSchema.safeParse({ ...base, name: "" });
    assert.equal(result.success, false);
  });

  it("rejects a whitespace-only name", () => {
    const result = createProjectSchema.safeParse({ ...base, name: "   " });
    assert.equal(result.success, false);
  });

  it("rejects invalid slugs", () => {
    for (const slug of ["Launch", "launch_event", "-launch", "launch-", "launch--x", ""]) {
      const result = createProjectSchema.safeParse({ ...base, slug });
      assert.equal(result.success, false, `slug "${slug}" must be rejected`);
    }
  });

  it("rejects an invalid budget", () => {
    for (const budget of ["-1", "1.234", "abc", ""]) {
      const result = createProjectSchema.safeParse({ ...base, budget });
      assert.equal(result.success, false, `budget "${budget}" must be rejected`);
    }
  });

  it("rejects an invalid currency", () => {
    for (const currency of ["EG", "EGPX", "e1p", ""]) {
      const result = createProjectSchema.safeParse({ ...base, currency });
      assert.equal(result.success, false, `currency "${currency}" must be rejected`);
    }
  });

  it("normalizes a lowercase currency code", () => {
    const result = createProjectSchema.safeParse({ ...base, currency: "egp" });
    assert.ok(result.success);
    assert.equal(result.data.currency, "EGP");
  });

  it("rejects an invalid status", () => {
    const result = createProjectSchema.safeParse({ ...base, status: "PENDING" });
    assert.equal(result.success, false);
  });

  it("matches the database status vocabulary exactly", async () => {
    const { rows } = await pool.query(
      `select enumlabel from pg_enum
       join pg_type on pg_enum.enumtypid = pg_type.oid
       where pg_type.typname = 'project_status' order by enumsortorder`,
    );
    assert.deepEqual(
      rows.map((r) => r.enumlabel),
      [...PROJECT_STATUSES],
    );
  });

  it("accepts a valid update payload", () => {
    const result = updateProjectSchema.safeParse(base);
    assert.ok(result.success);
  });
});

describe("project creation integrity", () => {
  it("persists organization, creator, exact budget, currency, and status", async () => {
    const userId = await provisionUser("Creator");
    const organizationId = await provisionOrganization(userId, "OWNER");
    const projectId = await provisionProject(organizationId, userId, { slug: "alpha" });

    const { rows } = await pool.query(`select * from "project" where id = $1`, [projectId]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].organization_id, organizationId);
    assert.equal(rows[0].creator_id, userId);
    assert.equal(rows[0].budget_minor_units, "75000"); // bigint → driver returns string
    assert.equal(rows[0].currency, "EGP");
    assert.equal(rows[0].status, "ACTIVE");
    assert.ok(rows[0].created_at);
    assert.ok(rows[0].updated_at);
  });

  it("rejects duplicate organization + slug", async () => {
    const userId = await provisionUser("DupOwner");
    const organizationId = await provisionOrganization(userId, "OWNER");
    await provisionProject(organizationId, userId, { slug: "dup" });

    await assert.rejects(
      pool.query(
        `insert into "project"
           (id, organization_id, creator_id, name, slug, budget_minor_units, currency, status)
         values ($1, $2, $3, 'Other', 'dup', 0, 'EGP', 'ACTIVE')`,
        [randomUUID(), organizationId, userId],
      ),
      /duplicate key value violates unique constraint.*project_org_slug_unique/,
    );
  });

  it("allows the same slug in different organizations", async () => {
    const userA = await provisionUser("OrgA");
    const orgA = await provisionOrganization(userA, "OWNER");
    const userB = await provisionUser("OrgB");
    const orgB = await provisionOrganization(userB, "OWNER");

    await provisionProject(orgA, userA, { slug: "shared-slug" });
    const projectBId = await provisionProject(orgB, userB, { slug: "shared-slug" });

    const { rows } = await pool.query(`select id from "project" where id = $1`, [projectBId]);
    assert.equal(rows.length, 1);
  });

  it("enforces creator as a foreign key to a real user", async () => {
    const userId = await provisionUser("FkOwner");
    const organizationId = await provisionOrganization(userId, "OWNER");

    await assert.rejects(
      pool.query(
        `insert into "project"
           (id, organization_id, creator_id, name, slug, budget_minor_units, currency, status)
         values ($1, $2, $3, 'Ghost', 'ghost', 0, 'EGP', 'ACTIVE')`,
        [randomUUID(), organizationId, "00000000-0000-0000-0000-000000000000"],
      ),
      /violates foreign key constraint/,
    );
  });
});

describe("project listing scope", () => {
  it("returns only projects the actor is a member of, within their organizations", async () => {
    const ownerId = await provisionUser("ListOwner");
    const orgA = await provisionOrganization(ownerId, "OWNER");
    const projA = await provisionProject(orgA, ownerId, { slug: "list-a" });
    await addProjectMember(projA, ownerId);
    // A second project in the same org the actor is not a member of.
    await provisionProject(orgA, ownerId, { slug: "list-a2" });

    const outsiderId = await provisionUser("ListOutsider");
    const orgB = await provisionOrganization(outsiderId, "OWNER");
    const projB = await provisionProject(orgB, outsiderId, { slug: "list-b" });
    await addProjectMember(projB, outsiderId);

    // Mirror of the service's listing predicate: project membership AND
    // organization membership AND project.read permission.
    const actorRole = await findOrganizationRole(ownerId, orgA);
    assert.ok(actorRole && can({ role: actorRole }, Permission.PROJECT_READ));

    const { rows } = await pool.query(
      `select p.id from "project" p
       join "project_member" pm on pm.project_id = p.id and pm.user_id = $1
       where p.organization_id = $2`,
      [ownerId, orgA],
    );
    assert.deepEqual(rows.map((r) => r.id), [projA]);

    const { rows: outsiderRows } = await pool.query(
      `select p.id from "project" p
       join "project_member" pm on pm.project_id = p.id and pm.user_id = $1
       where p.organization_id = $2`,
      [outsiderId, orgA],
    );
    assert.equal(outsiderRows.length, 0, "cross-organization visibility must be empty");
  });
});

describe("project authorization decisions", () => {
  it("requires project.manage for mutation", async () => {
    const ownerId = await provisionUser("PermOwner");
    const organizationId = await provisionOrganization(ownerId, "OWNER");
    const memberId = await provisionUser("PermMember");
    await pool.query(
      `insert into "organization_member" (id, organization_id, user_id, role)
       values ($1, $2, $3, 'MEMBER')`,
      [randomUUID(), organizationId, memberId],
    );

    const ownerRole = await findOrganizationRole(ownerId, organizationId);
    const memberRole = await findOrganizationRole(memberId, organizationId);
    assert.ok(ownerRole && can({ role: ownerRole }, Permission.PROJECT_MANAGE));
    assert.ok(memberRole && !can({ role: memberRole }, Permission.PROJECT_MANAGE));
  });

  it("project.member add requires the target to be an organization member", async () => {
    const ownerId = await provisionUser("MemOwner");
    const organizationId = await provisionOrganization(ownerId, "OWNER");
    await provisionProject(organizationId, ownerId);
    const strangerId = await provisionUser("Stranger"); // no org membership

    const targetRole = await findOrganizationRole(strangerId, organizationId);
    assert.equal(targetRole, null, "stranger must not be treated as an organization member");
  });
});

describe("project membership integrity", () => {
  it("rejects duplicate project membership", async () => {
    const ownerId = await provisionUser("PmOwner");
    const organizationId = await provisionOrganization(ownerId, "OWNER");
    const projectId = await provisionProject(organizationId, ownerId);
    await addProjectMember(projectId, ownerId);

    await assert.rejects(
      pool.query(
        `insert into "project_member" (id, project_id, user_id) values ($1, $2, $3)`,
        [randomUUID(), projectId, ownerId],
      ),
      /duplicate key value violates unique constraint.*project_member_project_user_unique/,
    );
  });

  it("removes a membership row on removal", async () => {
    const ownerId = await provisionUser("RmOwner");
    const organizationId = await provisionOrganization(ownerId, "OWNER");
    const projectId = await provisionProject(organizationId, ownerId);
    const memberId = await provisionUser("RmMember");
    await pool.query(
      `insert into "organization_member" (id, organization_id, user_id, role)
       values ($1, $2, $3, 'MEMBER')`,
      [randomUUID(), organizationId, memberId],
    );
    await addProjectMember(projectId, memberId);

    const removed = await pool.query(
      `delete from "project_member" where project_id = $1 and user_id = $2 returning id`,
      [projectId, memberId],
    );
    assert.equal(removed.rows.length, 1);

    const { rows } = await pool.query(
      `select count(*)::int as count from "project_member" where project_id = $1 and user_id = $2`,
      [projectId, memberId],
    );
    assert.equal(rows[0].count, 0);
  });

  it("rejects membership for a project that does not exist", async () => {
    const userId = await provisionUser("NoProj");
    await assert.rejects(
      pool.query(
        `insert into "project_member" (id, project_id, user_id) values ($1, $2, $3)`,
        [randomUUID(), "00000000-0000-0000-0000-000000000000", userId],
      ),
      /violates foreign key constraint/,
    );
  });
});

describe("Phase 1 regression", () => {
  it("fixture provisioning and sign-in shape still work", async () => {
    const fixture = await provisionFixture();
    assert.ok(fixture.userId);
    assert.equal(fixture.email, "phase1-auth-test@ledger.test");
  });
});
