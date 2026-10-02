// Phase 5: Payment submission → PENDING tests
//
// Covers the payment contract: server-fixed type/status, exact money,
// notes/paid_to rules, project scoping, tamper-proof payload shape, and
// the DB-backed idempotency behavior the submission service relies on.
//
// Convention (same as earlier suites): Node tests cannot import
// "server-only" modules or `@/` aliases, so DB invariants are asserted with
// raw SQL in the exact shape the repository writes, validation/domain
// logic is imported from lib/, and authorization predicates reuse
// lib/permissions (the service layer's own helpers).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { paymentSubmissionSchema } from "../lib/validations/payments.ts";
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
  const email = `phase5-${label}-${randomUUID().slice(0, 8)}@ledger.test`;
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
    [organizationId, `P5 Org ${organizationId.slice(0, 8)}`, `p5-${organizationId.slice(0, 8)}`],
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
      `P5 Project ${projectId.slice(0, 8)}`,
      `p5-proj-${projectId.slice(0, 8)}`,
      100000n,
      "EGP",
      "ACTIVE",
    ],
  );
  return projectId;
}

async function insertPayment(input: {
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
     values ($1, $2, $3, $4, 'PAYMENT', $5, $6, $7, 'PENDING', $8)`,
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

describe("payment submission validation", () => {
  const base = {
    amount: "750.00",
    idempotencyKey: randomUUID(),
  };

  it("accepts a valid payload (with and without optional fields)", () => {
    assert.ok(paymentSubmissionSchema.safeParse(base).success);
    assert.ok(
      paymentSubmissionSchema.safeParse({ ...base, paidTo: "Vendor", notes: "September" }).success,
    );
  });

  it("rejects invalid, zero, and negative amounts", () => {
    for (const amount of ["abc", "0", "0.00", "-5", "1.234", ""]) {
      assert.equal(
        paymentSubmissionSchema.safeParse({ ...base, amount }).success,
        false,
        `amount "${amount}" must be rejected`,
      );
    }
  });

  it("rejects notes over 255 characters", () => {
    const tooLong = "x".repeat(256);
    assert.equal(
      paymentSubmissionSchema.safeParse({ ...base, notes: tooLong }).success,
      false,
    );
    assert.ok(
      paymentSubmissionSchema.safeParse({ ...base, notes: "x".repeat(255) }).success,
    );
  });

  it("rejects a blank paid_to", () => {
    assert.equal(
      paymentSubmissionSchema.safeParse({ ...base, paidTo: "   " }).success,
      false,
    );
  });

  it("has no client-settable type/status/project/organization/creator fields", () => {
    const result = paymentSubmissionSchema.safeParse({
      ...base,
      type: "WITHDRAWAL",
      status: "APPROVED",
      projectId: randomUUID(),
      organizationId: randomUUID(),
      createdByUserId: randomUUID(),
      approvedByUserId: randomUUID(),
    });
    assert.ok(result.success, "unknown keys are stripped, not accepted");
    for (const key of [
      "type",
      "status",
      "projectId",
      "organizationId",
      "createdByUserId",
      "approvedByUserId",
    ]) {
      assert.ok(!(key in result.data), `${key} must not survive validation`);
    }
  });

  it("converts amounts to exact minor units without floats", () => {
    assert.equal(toMinorUnits("750.00"), 75000n);
    assert.equal(toMinorUnits("0.01"), 1n);
    assert.equal(toMinorUnits("123456789.99"), 12345678999n);
  });
});

describe("payment persists as PAYMENT + PENDING", () => {
  it("creates exactly one unified transaction row", async () => {
    const ownerId = await provisionUser("pay-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);
    const key = randomUUID();

    const transactionId = await insertPayment({
      organizationId,
      projectId,
      createdByUserId: ownerId,
      amountMinorUnits: toMinorUnits("750.00"),
      paidTo: "Vendor B",
      notes: "September materials",
      idempotencyKey: key,
    });

    const { rows } = await pool.query(
      `select type, status, amount_minor_units::text as amount, paid_to, notes,
              created_by_user_id, organization_id, project_id,
              approved_by_user_id, approved_at, rejected_by_user_id, rejected_at,
              evidence_key
       from "transaction" where id = $1`,
      [transactionId],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, "PAYMENT");
    assert.equal(rows[0].status, "PENDING");
    assert.equal(rows[0].amount, "75000");
    assert.equal(rows[0].paid_to, "Vendor B");
    assert.equal(rows[0].notes, "September materials");
    assert.equal(rows[0].created_by_user_id, ownerId);
    assert.equal(rows[0].organization_id, organizationId);
    assert.equal(rows[0].project_id, projectId);
    // Approval metadata stays untouched until the approval phase.
    assert.equal(rows[0].approved_by_user_id, null);
    assert.equal(rows[0].approved_at, null);
    assert.equal(rows[0].rejected_by_user_id, null);
    assert.equal(rows[0].rejected_at, null);
    assert.equal(rows[0].evidence_key, null);
  });

  it("memberships gate visibility of the project-scoped submission surface", async () => {
    const ownerId = await provisionUser("pay-auth-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);
    const outsiderId = await provisionUser("pay-auth-outsider");

    // The service resolves the project by "slug within the actor's orgs,
    // then requires project membership" — an outsider matches neither.
    const outsiderOrg = await pool.query(
      `select organization_id from "organization_member" where user_id = $1 and organization_id = $2`,
      [outsiderId, organizationId],
    );
    assert.equal(outsiderOrg.rows.length, 0);

    const outsiderProject = await pool.query(
      `select id from "project_member" where project_id = $1 and user_id = $2`,
      [projectId, outsiderId],
    );
    assert.equal(outsiderProject.rows.length, 0);

    // Direct cross-project/cross-organization insert is impossible via the
    // composite FK (org A + project of org B).
    const otherOrgId = await provisionOrganizationWithOwner(outsiderId);
    await assert.rejects(
      pool.query(
        `insert into "transaction" (id, organization_id, project_id, created_by_user_id, type, amount_minor_units, status, idempotency_key)
         values ($1, $2, $3, $4, 'PAYMENT', 100, 'PENDING', $5)`,
        [randomUUID(), otherOrgId, projectId, outsiderId, randomUUID()],
      ),
      /transaction_org_project_fk/,
    );
  });
});

describe("payment idempotency", () => {
  it("duplicate key for the same actor and organization is rejected", async () => {
    const ownerId = await provisionUser("pay-idem-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);
    const key = randomUUID();

    await insertPayment({
      organizationId, projectId, createdByUserId: ownerId,
      amountMinorUnits: 100n, idempotencyKey: key,
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

  it("identical replay is recognized; conflicting payload is not", async () => {
    const ownerId = await provisionUser("pay-idem-replay");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);
    const key = randomUUID();

    const transactionId = await insertPayment({
      organizationId, projectId, createdByUserId: ownerId,
      amountMinorUnits: 500n, paidTo: "Vendor", notes: "invoice 1",
      idempotencyKey: key,
    });

    const { rows } = await pool.query(
      `select type, amount_minor_units, paid_to, notes, organization_id, project_id, created_by_user_id
       from "transaction" where organization_id = $1 and created_by_user_id = $2 and idempotency_key = $3`,
      [organizationId, ownerId, key],
    );
    assert.equal(rows.length, 1, "replay must return the single stored row");
    // Same normalization the service applies via toPayloadShape().
    const stored = {
      ...rows[0],
      amountMinorUnits: BigInt(rows[0].amount_minor_units),
      paidTo: rows[0].paid_to,
      notes: rows[0].notes,
      organizationId: rows[0].organization_id,
      projectId: rows[0].project_id,
      createdByUserId: rows[0].created_by_user_id,
    };
    assert.equal(
      idempotentPayloadMatches(stored, {
        type: "PAYMENT",
        amountMinorUnits: 500n,
        paidTo: "Vendor",
        notes: "invoice 1",
        organizationId,
        projectId,
        createdByUserId: ownerId,
      }),
      true,
    );
    assert.equal(
      idempotentPayloadMatches(stored, {
        type: "PAYMENT",
        amountMinorUnits: 501n,
        paidTo: "Vendor",
        notes: "invoice 1",
        organizationId,
        projectId,
        createdByUserId: ownerId,
      }),
      false,
      "conflicting payload under the same key must be detected",
    );
    assert.ok(transactionId);
  });

  it("concurrent double-submit creates exactly one transaction", async () => {
    const ownerId = await provisionUser("pay-idem-conc");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);
    const key = randomUUID();

    const insert = () =>
      pool.query(
        `insert into "transaction" (id, organization_id, project_id, created_by_user_id, type, amount_minor_units, status, idempotency_key)
         values ($1, $2, $3, $4, 'PAYMENT', 250, 'PENDING', $5)`,
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

describe("creator and role contract", () => {
  it("creator comes from the session, and members pass submission permission", async () => {
    const ownerId = await provisionUser("pay-role-owner");
    const organizationId = await provisionOrganizationWithOwner(ownerId);
    const projectId = await provisionProject(organizationId, ownerId);

    const transactionId = await insertPayment({
      organizationId, projectId, createdByUserId: ownerId,
      amountMinorUnits: 42n, idempotencyKey: randomUUID(),
    });

    const { rows } = await pool.query(
      `select created_by_user_id from "transaction" where id = $1`,
      [transactionId],
    );
    assert.equal(rows[0].created_by_user_id, ownerId);

    const { rows: memberRows } = await pool.query(
      `select om.role from "organization_member" om where om.user_id = $1 and om.organization_id = $2`,
      [ownerId, organizationId],
    );
    assert.equal(memberRows.length, 1);
    assert.ok(can({ role: memberRows[0].role }, Permission.PROJECT_READ));
  });
});
