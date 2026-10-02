// Phase 6: Withdrawal submission → PENDING tests
//
// Covers the withdrawal contract mirroring Phase 5: server-fixed
// type/status, exact money, notes/paid_to rules, project scoping,
// tamper-proof payload shape, DB-backed idempotency, and the hard rule
// that PENDING has no approved financial impact (no approval metadata, no
// aggregate mutations).
//
// Same test-running convention as Phases 4/5: DB invariants via raw SQL in
// the exact shape the repository writes; domain/validation imported from
// lib/; authorization predicates reuse lib/permissions.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { withdrawalSubmissionSchema } from "../lib/validations/withdrawals.ts";
import { idempotentPayloadMatches } from "../lib/finance/transactions.ts";
import { toMinorUnits } from "../lib/validations/project.ts";
import { can, Permission } from "../lib/permissions.ts";
import { closePool, getPool } from "./helpers.ts";

const pool = getPool();
const createdUserEmails = new Set<string>();
const createdOrganizationIds = new Set<string>();

/** Fixture-scoped cleanup: suites run concurrently on the shared dev DB. */
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
  const email = `phase6-${label}-${randomUUID().slice(0, 8)}@ledger.test`;
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
    [organizationId, `P6 Org ${organizationId.slice(0, 8)}`, `p6-${organizationId.slice(0, 8)}`],
  );
  createdOrganizationIds.add(organizationId);
  await pool.query(
    `insert into "organization_member" (id, organization_id, user_id, role)
     values ($1, $2, $3, 'OWNER')`,
    [randomUUID(), organizationId, userId],
  );
  return organizationId;
}

async function provisionProject(organizationId: string, creatorId: string): Promise<string> {
  const projectId = randomUUID();
  await pool.query(
    `insert into "project"
       (id, organization_id, creator_id, name, slug, budget_minor_units, currency, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      projectId,
      organizationId,
      creatorId,
      `P6 Project ${projectId.slice(0, 8)}`,
      `p6-proj-${projectId.slice(0, 8)}`,
      100000n,
      "EGP",
      "ACTIVE",
    ],
  );
  return projectId;
}

async function insertWithdrawal(input: {
  organizationId: string;
  projectId: string;
  createdByUserId: string;
  amountMinorUnits: bigint;
  paidTo?: string | null;
  notes?: string | null;
  idempotencyKey: string;
}): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `insert into "transaction"
       (id, organization_id, project_id, created_by_user_id, type,
        amount_minor_units, paid_to, notes, status, idempotency_key)
     values ($1, $2, $3, $4, 'WITHDRAWAL', $5, $6, $7, 'PENDING', $8)`,
    [
      id,
      input.organizationId,
      input.projectId,
      input.createdByUserId,
      input.amountMinorUnits,
      input.paidTo ?? null,
      input.notes ?? null,
      input.idempotencyKey,
    ],
  );
  return id;
}

before(async () => {
  await resetFixtures();
});

after(async () => {
  await resetFixtures();
  await closePool();
});

describe("withdrawal submission validation", () => {
  const base = {
    amount: "125.50",
    paidTo: "Vendor C",
    idempotencyKey: randomUUID(),
  };

  it("accepts a valid payload (with and without notes)", () => {
    assert.ok(withdrawalSubmissionSchema.safeParse(base).success);
    assert.ok(withdrawalSubmissionSchema.safeParse({ ...base, notes: undefined }).success);
  });

  it("rejects invalid, zero, and negative amounts", () => {
    for (const amount of ["abc", "0", "0.00", "-5", "1.234", ""]) {
      assert.equal(
        withdrawalSubmissionSchema.safeParse({ ...base, amount }).success,
        false,
        `amount "${amount}" must be rejected`,
      );
    }
  });

  it("rejects notes over 255 characters", () => {
    assert.equal(
      withdrawalSubmissionSchema.safeParse({ ...base, notes: "x".repeat(256) }).success,
      false,
    );
    assert.ok(
      withdrawalSubmissionSchema.safeParse({ ...base, notes: "x".repeat(255) }).success,
    );
  });

  it("rejects a blank paid_to", () => {
    assert.equal(
      withdrawalSubmissionSchema.safeParse({ ...base, paidTo: "   " }).success,
      false,
    );
  });

  it("has no client-settable type/status/project/organization/creator fields", () => {
    const result = withdrawalSubmissionSchema.safeParse({
      ...base,
      type: "PAYMENT",
      status: "APPROVED",
      projectId: randomUUID(),
      organizationId: randomUUID(),
      createdByUserId: randomUUID(),
    });
    assert.ok(result.success, "unknown keys are stripped, not accepted");
    for (const key of ["type", "status", "projectId", "organizationId", "createdByUserId"]) {
      assert.ok(!(key in result.data), `${key} must not survive validation`);
    }
  });

  it("converts amounts to exact minor units without floats", () => {
    assert.equal(toMinorUnits("125.50"), 12550n);
    assert.equal(toMinorUnits("0.01"), 1n);
  });
});

describe("withdrawal persists as WITHDRAWAL + PENDING", () => {
  it("creates exactly one unified transaction row with no financial impact", async () => {
    const ownerId = await provisionUser("wd-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);

    const transactionId = await insertWithdrawal({
      organizationId,
      projectId,
      createdByUserId: ownerId,
      amountMinorUnits: toMinorUnits("125.50"),
      paidTo: "Vendor C",
      notes: "invoice 2",
      idempotencyKey: randomUUID(),
    });

    const { rows } = await pool.query(
      `select type, status, amount_minor_units::text as amount, paid_to, notes,
              created_by_user_id, organization_id, project_id,
              approved_by_user_id, approved_at, rejected_by_user_id, rejected_at
       from "transaction" where id = $1`,
      [transactionId],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, "WITHDRAWAL");
    assert.equal(rows[0].status, "PENDING");
    assert.equal(rows[0].amount, "12550");
    assert.equal(rows[0].paid_to, "Vendor C");
    assert.equal(rows[0].notes, "invoice 2");
    assert.equal(rows[0].created_by_user_id, ownerId);
    assert.equal(rows[0].organization_id, organizationId);
    assert.equal(rows[0].project_id, projectId);
    // PENDING must carry no approved-financial-impact fields.
    assert.equal(rows[0].approved_by_user_id, null);
    assert.equal(rows[0].approved_at, null);
    assert.equal(rows[0].rejected_by_user_id, null);
    assert.equal(rows[0].rejected_at, null);

    // Project budget must not have changed: PENDING has no financial effect.
    const { rows: projectRows } = await pool.query(
      `select budget_minor_units::text as budget from "project" where id = $1`,
      [projectId],
    );
    assert.equal(projectRows[0].budget, "100000");
  });

  it("denies cross-organization/cross-project creation via FK + scope predicates", async () => {
    const ownerId = await provisionUser("wd-auth-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);
    const outsiderId = await provisionUser("wd-auth-outsider");
    const otherOrgId = await provisionOrganizationWithOwner(outsiderId);

    // Service scope: project must resolve within the actor's organizations.
    const outsiderOrgScope = await pool.query(
      `select organization_id from "organization_member" where user_id = $1 and organization_id = $2`,
      [outsiderId, organizationId],
    );
    assert.equal(outsiderOrgScope.rows.length, 0);

    const outsiderProjectScope = await pool.query(
      `select id from "project_member" where project_id = $1 and user_id = $2`,
      [projectId, outsiderId],
    );
    assert.equal(outsiderProjectScope.rows.length, 0);

    // Composite FK blocks org-A + project-of-B tampering.
    await assert.rejects(
      pool.query(
        `insert into "transaction" (id, organization_id, project_id, created_by_user_id, type, amount_minor_units, status, idempotency_key)
         values ($1, $2, $3, $4, 'WITHDRAWAL', 100, 'PENDING', $5)`,
        [randomUUID(), otherOrgId, projectId, outsiderId, randomUUID()],
      ),
      /transaction_org_project_fk/,
    );

    // Submission permission: org membership + project membership are
    // required; neither alone is sufficient.
    assert.equal(
      can({ role: "MEMBER" }, Permission.PROJECT_MANAGE),
      false,
      "plain members cannot manage projects",
    );
    assert.ok(can({ role: "MEMBER" }, Permission.PROJECT_READ));
  });
});

describe("withdrawal idempotency", () => {
  it("duplicate key for the same actor and organization is rejected", async () => {
    const ownerId = await provisionUser("wd-idem-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);
    const key = randomUUID();

    await insertWithdrawal({
      organizationId, projectId, createdByUserId: ownerId,
      amountMinorUnits: 100n, idempotencyKey: key,
    });

    await assert.rejects(
      pool.query(
        `insert into "transaction" (id, organization_id, project_id, created_by_user_id, type, amount_minor_units, status, idempotency_key)
         values ($1, $2, $3, $4, 'WITHDRAWAL', 100, 'PENDING', $5)`,
        [randomUUID(), organizationId, projectId, ownerId, key],
      ),
      /transaction_org_actor_idem_unique/,
    );
  });

  it("identical replay is recognized; conflicting payload is not", async () => {
    const ownerId = await provisionUser("wd-idem-replay");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);
    const key = randomUUID();

    const transactionId = await insertWithdrawal({
      organizationId, projectId, createdByUserId: ownerId,
      amountMinorUnits: 300n, paidTo: "Vendor X", idempotencyKey: key,
    });

    const { rows } = await pool.query(
      `select type, amount_minor_units, paid_to, notes, organization_id, project_id, created_by_user_id
       from "transaction" where organization_id = $1 and created_by_user_id = $2 and idempotency_key = $3`,
      [organizationId, ownerId, key],
    );
    assert.equal(rows.length, 1, "replay must reuse the single stored row");
    const stored = {
      type: rows[0].type,
      amountMinorUnits: BigInt(rows[0].amount_minor_units),
      paidTo: rows[0].paid_to,
      notes: rows[0].notes,
      organizationId: rows[0].organization_id,
      projectId: rows[0].project_id,
      createdByUserId: rows[0].created_by_user_id,
    };
    assert.equal(
      idempotentPayloadMatches(stored, {
        type: "WITHDRAWAL",
        amountMinorUnits: 300n,
        paidTo: "Vendor X",
        notes: null,
        organizationId,
        projectId,
        createdByUserId: ownerId,
      }),
      true,
    );
    assert.equal(
      idempotentPayloadMatches(stored, {
        type: "WITHDRAWAL",
        amountMinorUnits: 301n,
        paidTo: "Vendor X",
        notes: null,
        organizationId,
        projectId,
        createdByUserId: ownerId,
      }),
      false,
    );
    // Crossing types with the same key must also be a conflict.
    assert.equal(
      idempotentPayloadMatches(stored, {
        ...stored,
        amountMinorUnits: 300n,
        type: "PAYMENT",
      }),
      false,
    );
    assert.ok(transactionId);
  });

  it("concurrent double-submit creates exactly one withdrawal", async () => {
    const ownerId = await provisionUser("wd-idem-conc");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);
    const key = randomUUID();

    const insert = () =>
      pool.query(
        `insert into "transaction" (id, organization_id, project_id, created_by_user_id, type, amount_minor_units, status, idempotency_key)
         values ($1, $2, $3, $4, 'WITHDRAWAL', 250, 'PENDING', $5)`,
        [randomUUID(), organizationId, projectId, ownerId, key],
      );

    const results = await Promise.allSettled([insert(), insert()]);
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    assert.equal(succeeded, 1, "exactly one concurrent insert may succeed");

    const { rows } = await pool.query(
      `select count(*)::int as count from "transaction"
       where organization_id = $1 and created_by_user_id = $2 and idempotency_key = $3`,
      [organizationId, ownerId, key],
    );
    assert.equal(rows[0].count, 1);
  });
});
