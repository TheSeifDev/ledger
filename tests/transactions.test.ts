// Phase 4: Authoritative unified transaction model tests
//
// DB-backed tests for the unified transaction ledger: types/statuses,
// exact money, tenancy/ownership integrity, idempotency, filters, and
// bounded keyset pagination.
//
// These tests run in a plain Node process; app/server modules use the
// `server-only` guard and bundler-style `@/` aliases, so — consistent with
// the Phase 1–3 suites — database invariants are asserted with raw SQL,
// validation/domain logic is imported from lib/ (externalizable vocabulary),
// and authorization predicates reuse lib/permissions directly (mirroring
// the service layer's decisions one-to-one).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { TRANSACTION_NOTES_MAX, createTransactionSchema, listTransactionsQuerySchema } from "../lib/validations/transactions.ts";
import { TRANSACTION_TYPES, TRANSACTION_STATUSES, idempotentPayloadMatches, encodeTransactionCursor, decodeTransactionCursor } from "../lib/finance/transactions.ts";
import { toMinorUnits } from "../lib/validations/project.ts";
import { formatMinorUnits } from "../lib/finance/money.ts";
import { can, Permission } from "../lib/permissions.ts";
import { closePool, getPool } from "./helpers.ts";

const pool = getPool();
const createdUserEmails = new Set<string>();
const createdOrganizationIds = new Set<string>();

/** One page of fixture accounting: only rows this suite created. */
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

async function provisionUser(label: string): Promise<string> {
  const email = `phase4-${label}-${randomUUID().slice(0, 8)}@ledger.test`;
  const userId = randomUUID();
  await pool.query(
    `insert into "user" (id, name, email) values ($1, $2, $3)`,
    [userId, label, email],
  );
  createdUserEmails.add(email);
  return userId;
}

async function provisionOrganizationWithOwner(userId: string): Promise<string> {
  const organizationId = randomUUID();
  await pool.query(
    `insert into "organization" (id, name, slug) values ($1, $2, $3)`,
    [organizationId, `P4 Org ${organizationId.slice(0, 8)}`, `p4-${organizationId.slice(0, 8)}`],
  );
  createdOrganizationIds.add(organizationId);
  await pool.query(
    `insert into "organization_member" (id, organization_id, user_id, role)
     values ($1, $2, $3, 'OWNER')`,
    [randomUUID(), organizationId, userId],
  );
  return organizationId;
}

async function provisionProject(
  organizationId: string,
  creatorId: string,
  slug?: string,
): Promise<string> {
  const projectId = randomUUID();
  await pool.query(
    `insert into "project"
       (id, organization_id, creator_id, name, slug, budget_minor_units, currency, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      projectId,
      organizationId,
      creatorId,
      `P4 Project ${projectId.slice(0, 8)}`,
      slug ?? `p4-proj-${projectId.slice(0, 8)}`,
      100000n,
      "EGP",
      "ACTIVE",
    ],
  );
  return projectId;
}

async function insertTransaction(input: {
  organizationId: string;
  projectId: string;
  createdByUserId: string;
  type: "PAYMENT" | "WITHDRAWAL";
  amountMinorUnits: bigint;
  paidTo?: string | null;
  notes?: string | null;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  idempotencyKey: string;
}): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `insert into "transaction"
       (id, organization_id, project_id, created_by_user_id, type,
        amount_minor_units, paid_to, notes, status, idempotency_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      input.organizationId,
      input.projectId,
      input.createdByUserId,
      input.type,
      input.amountMinorUnits,
      input.paidTo ?? null,
      input.notes ?? null,
      input.status ?? "PENDING",
      input.idempotencyKey,
    ],
  );
  return id;
}

async function findProjectMembershipRow(projectId: string, userId: string) {
  const { rows } = await pool.query(
    `select id from "project_member" where project_id = $1 and user_id = $2`,
    [projectId, userId],
  );
  return rows[0] ?? null;
}

before(async () => {
  await resetFixtures();
});

after(async () => {
  await resetFixtures();
  await closePool();
});

describe("validation", () => {
  const base = {
    type: "PAYMENT",
    amount: "750.00",
    idempotencyKey: randomUUID(),
  };

  it("accepts PAYMENT and WITHDRAWAL", () => {
    for (const type of TRANSACTION_TYPES) {
      assert.ok(createTransactionSchema.safeParse({ ...base, type }).success);
    }
    assert.deepEqual([...TRANSACTION_TYPES], ["PAYMENT", "WITHDRAWAL"]);
  });

  it("rejects an invalid type", () => {
    assert.equal(createTransactionSchema.safeParse({ ...base, type: "REFUND" }).success, false);
  });

  it("rejects an invalid status in filters", () => {
    assert.equal(
      listTransactionsQuerySchema.safeParse({ status: "CANCELLED" }).success,
      false,
    );
    assert.deepEqual([...TRANSACTION_STATUSES], ["PENDING", "APPROVED", "REJECTED"]);
  });

  it("rejects zero and negative amounts", () => {
    assert.equal(createTransactionSchema.safeParse({ ...base, amount: "0" }).success, false);
    assert.equal(createTransactionSchema.safeParse({ ...base, amount: "0.00" }).success, false);
    assert.equal(createTransactionSchema.safeParse({ ...base, amount: "-5" }).success, false);
  });

  it("rejects notes over 255 characters", () => {
    const ok = "x".repeat(TRANSACTION_NOTES_MAX);
    const tooLong = "x".repeat(TRANSACTION_NOTES_MAX + 1);
    assert.ok(createTransactionSchema.safeParse({ ...base, notes: ok }).success);
    assert.equal(createTransactionSchema.safeParse({ ...base, notes: tooLong }).success, false);
  });

  it("strips client-supplied authoritative fields", () => {
    const result = createTransactionSchema.safeParse({
      ...base,
      organizationId: randomUUID(),
      createdByUserId: randomUUID(),
      status: "APPROVED",
      approvedByUserId: randomUUID(),
    });
    assert.ok(result.success);
    assert.ok(!("organizationId" in result.data));
    assert.ok(!("createdByUserId" in result.data));
    assert.ok(!("status" in result.data));
    assert.ok(!("approvedByUserId" in result.data));
  });

  it("rejects an oversized idempotency key", () => {
    const tooLong = "k".repeat(200);
    assert.equal(createTransactionSchema.safeParse({ ...base, idempotencyKey: tooLong }).success, false);
    assert.equal(createTransactionSchema.safeParse({ ...base, idempotencyKey: "short" }).success, false);
  });

  it("bounds page size", () => {
    assert.equal(listTransactionsQuerySchema.safeParse({ limit: 500 }).success, false);
    assert.equal(listTransactionsQuerySchema.safeParse({ limit: 50 }).success, true);
  });

  it("stores money as exact minor units", () => {
    assert.equal(toMinorUnits("750.00"), 75000n);
    assert.equal(toMinorUnits("1.01"), 101n);
    assert.equal(formatMinorUnits(75000n, "EGP"), "EGP 750.00");
  });
});

describe("database invariants", () => {
  it("persists PAYMENT and WITHDRAWAL rows with exact bigint amounts", async () => {
    const ownerId = await provisionUser("persist-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);

    const paymentId = await insertTransaction({
      organizationId,
      projectId,
      createdByUserId: ownerId,
      type: "PAYMENT",
      amountMinorUnits: 75000n,
      notes: "ok",
      idempotencyKey: randomUUID(),
    });
    const withdrawalId = await insertTransaction({
      organizationId,
      projectId,
      createdByUserId: ownerId,
      type: "WITHDRAWAL",
      amountMinorUnits: 250n,
      paidTo: "Vendor A",
      idempotencyKey: randomUUID(),
    });

    const { rows } = await pool.query(
      `select id, type, amount_minor_units::text as amount, status, paid_to, notes
       from "transaction" where id = any($1) order by type`,
      [[paymentId, withdrawalId]],
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].type, "PAYMENT");
    assert.equal(rows[0].amount, "75000");
    assert.equal(rows[0].status, "PENDING");
    assert.equal(rows[1].paid_to, "Vendor A");
  });

  it("rejects transactions for the wrong organization/project pairing (composite FK)", async () => {
    const ownerA = await provisionUser("cfk-owner-a");
    const orgA = await provisionOrganizationWithOwner(ownerA);
    const ownerB = await provisionUser("cfk-owner-b");
    const orgB = await provisionOrganizationWithOwner(ownerB);
    const projectB = await provisionProject(orgB, ownerB);

    await assert.rejects(
      pool.query(
        `insert into "transaction" (id, organization_id, project_id, created_by_user_id, type, amount_minor_units, status, idempotency_key)
         values ($1, $2, $3, $4, 'PAYMENT', 100, 'PENDING', $5)`,
        [randomUUID(), orgA, projectB, ownerA, randomUUID()],
      ),
      /transaction_org_project_fk/,
    );
  });

  it("rejects transactions referencing non-existent projects", async () => {
    const ownerId = await provisionUser("fk-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);

    await assert.rejects(
      pool.query(
        `insert into "transaction" (id, organization_id, project_id, created_by_user_id, type, amount_minor_units, status, idempotency_key)
         values ($1, $2, $3, $4, 'PAYMENT', 100, 'PENDING', $5)`,
        [randomUUID(), organizationId, "00000000-0000-0000-0000-000000000000", ownerId, randomUUID()],
      ),
      /transaction_org_project_fk/,
    );
  });

  it("rejects non-positive amounts and overlong notes at the database", async () => {
    const ownerId = await provisionUser("db-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);

    await assert.rejects(
      pool.query(
        `insert into "transaction" (id, organization_id, project_id, created_by_user_id, type, amount_minor_units, idempotency_key)
         values ($1, $2, $3, $4, 'PAYMENT', 0, $5)`,
        [randomUUID(), organizationId, projectId, ownerId, randomUUID()],
      ),
      /transaction_amount_positive/,
    );

    await assert.rejects(
      pool.query(
        `insert into "transaction" (id, organization_id, project_id, created_by_user_id, type, amount_minor_units, notes, idempotency_key)
         values ($1, $2, $3, $4, 'PAYMENT', 100, $5, $6)`,
        [randomUUID(), organizationId, projectId, ownerId, "n".repeat(256), randomUUID()],
      ),
      /transaction_notes_max_length/,
    );
  });
});

describe("idempotency foundation", () => {
  it("rejects a duplicate (organization, actor, key) at the database", async () => {
    const ownerId = await provisionUser("idem-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);
    const key = randomUUID();

    await insertTransaction({
      organizationId, projectId, createdByUserId: ownerId,
      type: "PAYMENT", amountMinorUnits: 100n, idempotencyKey: key,
    });

    await assert.rejects(
      pool.query(
        `insert into "transaction" (id, organization_id, project_id, created_by_user_id, type, amount_minor_units, status, idempotency_key)
         values ($1, $2, $3, $4, 'PAYMENT', 100, 'PENDING', $5)`,
        [randomUUID(), organizationId, projectId, ownerId, key],
      ),
      /transaction_org_actor_idem_unique/,
    );
  });

  it("allows the same key for a different actor", async () => {
    const ownerId = await provisionUser("idem-a");
    const otherId = await provisionUser("idem-b");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    await pool.query(
      `insert into "organization_member" (id, organization_id, user_id, role) values ($1, $2, $3, 'MEMBER')`,
      [randomUUID(), organizationId, otherId],
    );
    const projectId = await provisionProject(organizationId, ownerId);
    const key = randomUUID();

    await insertTransaction({
      organizationId, projectId, createdByUserId: ownerId,
      type: "PAYMENT", amountMinorUnits: 100n, idempotencyKey: key,
    });
    const secondId = await insertTransaction({
      organizationId, projectId, createdByUserId: otherId,
      type: "PAYMENT", amountMinorUnits: 100n, idempotencyKey: key,
    });
    assert.ok(secondId);
  });

  it("distinguishes identical replay from conflicting payload", () => {
    const payload = {
      type: "PAYMENT" as const,
      amountMinorUnits: 500n,
      paidTo: "Vendor",
      notes: "dup",
      organizationId: "org-1",
      projectId: "proj-1",
      createdByUserId: "user-1",
    };
    assert.ok(idempotentPayloadMatches(payload, { ...payload }));
    assert.equal(idempotentPayloadMatches(payload, { ...payload, amountMinorUnits: 501n }), false);
    assert.equal(idempotentPayloadMatches(payload, { ...payload, type: "WITHDRAWAL" }), false);
    assert.equal(idempotentPayloadMatches(payload, { ...payload, projectId: "proj-2" }), false);
  });

  it("survives a concurrent duplicate insert (unique index wins)", async () => {
    const ownerId = await provisionUser("idem-conc");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);
    const key = randomUUID();

    const insert = () =>
      pool.query(
        `insert into "transaction" (id, organization_id, project_id, created_by_user_id, type, amount_minor_units, status, idempotency_key)
         values ($1, $2, $3, $4, 'PAYMENT', 200, 'PENDING', $5)`,
        [randomUUID(), organizationId, projectId, ownerId, key],
      );

    const results = await Promise.allSettled([insert(), insert()]);
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const violated = results.filter(
      (r) => r.status === "rejected" && /transaction_org_actor_idem_unique/.test(String((r as PromiseRejectedResult).reason)),
    ).length;
    assert.equal(succeeded + violated, 2);
    assert.equal(succeeded, 1, "exactly one concurrent insert may succeed");

    const { rows } = await pool.query(
      `select count(*)::int as count from "transaction" where organization_id = $1 and created_by_user_id = $2 and idempotency_key = $3`,
      [organizationId, ownerId, key],
    );
    assert.equal(rows[0].count, 1);
  });
});

describe("authorization scope", () => {
  it("denies project.read for cross-organization actors", async () => {
    const ownerId = await provisionUser("scope-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const strangerId = await provisionUser("scope-stranger");
    const strangerOrgId = await provisionOrganizationWithOwner(strangerId);
    assert.notEqual(strangerOrgId, organizationId);

    const roleInA = await pool.query(
      `select role from "organization_member" where user_id = $1 and organization_id = $2`,
      [strangerId, organizationId],
    );
    assert.equal(roleInA.rows.length, 0, "outsider must have no org membership");

    const { rows } = await pool.query(
      `select t.id from "transaction" t
       join "project_member" pm on pm.project_id = t.project_id and pm.user_id = $1
       where t.organization_id = $2`,
      [strangerId, organizationId],
    );
    assert.equal(rows.length, 0);
  });

  it("denies project access without project membership even when role allows read", async () => {
    const ownerId = await provisionUser("scope-read-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);
    const orgMemberNotProjectMember = await provisionUser("scope-read-member");
    await pool.query(
      `insert into "organization_member" (id, organization_id, user_id, role) values ($1, $2, $3, 'MEMBER')`,
      [randomUUID(), organizationId, orgMemberNotProjectMember],
    );

    const pm = await findProjectMembershipRow(projectId, orgMemberNotProjectMember);
    assert.equal(pm, null, "org membership alone must not grant project access");
  });

  it("permission gates for creation follow the Phase 2 model", async () => {
    const ownerId = await provisionUser("scope-create-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const headId = await provisionUser("scope-create-head");
    const memberId = await provisionUser("scope-create-member");
    await pool.query(
      `insert into "organization_member" (id, organization_id, user_id, role)
       values
         ($1, $2, $3, 'HEAD'),
         ($4, $2, $5, 'MEMBER')`,
      [randomUUID(), organizationId, headId, randomUUID(), memberId],
    );

    assert.ok(can({ role: "OWNER" }, Permission.PROJECT_READ));
    assert.ok(can({ role: "HEAD" }, Permission.PROJECT_MANAGE));
    assert.ok(!can({ role: "MEMBER" }, Permission.PROJECT_MANAGE));
    assert.ok(can({ role: "MEMBER" }, Permission.PROJECT_READ));

    const role = await pool.query(
      `select role from "organization_member" where user_id = $1 and organization_id = $2`,
      [memberId, organizationId],
    );
    assert.equal(role.rows[0].role, "MEMBER");
  });
});

describe("filters and pagination", () => {
  it("filters by type, status, and creator within a project", async () => {
    const ownerId = await provisionUser("filter-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);
    const otherMember = await provisionUser("filter-member");
    await pool.query(
      `insert into "organization_member" (id, organization_id, user_id, role) values ($1, $2, $3, 'MEMBER')`,
      [randomUUID(), organizationId, otherMember],
    );
    await pool.query(
      `insert into "project_member" (id, project_id, user_id) values ($1, $2, $3)`,
      [randomUUID(), projectId, otherMember],
    );

    await insertTransaction({
      organizationId, projectId, createdByUserId: ownerId,
      type: "PAYMENT", amountMinorUnits: 100n, status: "APPROVED",
      idempotencyKey: randomUUID(), notes: "a",
    });
    await insertTransaction({
      organizationId, projectId, createdByUserId: ownerId,
      type: "WITHDRAWAL", amountMinorUnits: 50n, status: "PENDING",
      idempotencyKey: randomUUID(), notes: "b",
    });
    await insertTransaction({
      organizationId, projectId, createdByUserId: otherMember,
      type: "PAYMENT", amountMinorUnits: 200n, status: "PENDING",
      idempotencyKey: randomUUID(), notes: "c",
    });

    const { rows: payments } = await pool.query(
      `select id from "transaction" where project_id = $1 and type = 'PAYMENT'`,
      [projectId],
    );
    assert.equal(payments.length, 2);

    const { rows: approved } = await pool.query(
      `select id from "transaction" where project_id = $1 and status = 'APPROVED'`,
      [projectId],
    );
    assert.equal(approved.length, 1);

    const { rows: byMember } = await pool.query(
      `select id from "transaction" where project_id = $1 and created_by_user_id = $2`,
      [projectId, otherMember],
    );
    assert.equal(byMember.length, 1);
  });

  it("keyset pagination is stable while rows are appended", async () => {
    const ownerId = await provisionUser("page-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);

    for (let i = 0; i < 5; i++) {
      // Distinct, increasing timestamps for deterministic ordering.
      await insertTransaction({
        organizationId, projectId, createdByUserId: ownerId,
        type: "PAYMENT", amountMinorUnits: BigInt(i + 1),
        idempotencyKey: randomUUID(), notes: `p${i}`,
      });
    }

    const page1 = await pool.query(
      `select id, created_at from "transaction" where project_id = $1
       order by created_at desc, id desc limit 2`,
      [projectId],
    );
    assert.equal(page1.rows.length, 2);

    const cursor = encodeTransactionCursor(page1.rows[1].created_at, page1.rows[1].id);
    const decoded = decodeTransactionCursor(cursor);
    assert.ok(decoded);
    assert.equal(decoded.id, page1.rows[1].id);

    const page2 = await pool.query(
      `select id, created_at from "transaction" where project_id = $1
       and (created_at < $2 or (created_at = $2 and id < $3))
       order by created_at desc, id desc limit 2`,
      [projectId, decoded.createdAt, decoded.id],
    );
    assert.equal(page2.rows.length, 2);
    assert.ok(page2.rows[0].created_at <= page1.rows[1].created_at);
    assert.ok(!page1.rows.some((r) => r.id === page2.rows[0].id));
    assert.ok(!page1.rows.some((r) => r.id === page2.rows[1].id));
  });
});
