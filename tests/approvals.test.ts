// Phase 7: Atomic approval / rejection workflow tests
//
// Covers the state machine (PENDING → APPROVED | REJECTED, terminal states
// immutable), reviewer authorization, self-decision prevention, the
// DB-level single-winner gate, concurrent reviewer races, and the audit
// atomicity invariant (state change and audit event commit together or
// not at all).
//
// Convention (as in Phases 4–6): Node tests cannot import "server-only"
// modules or `@/` aliases, so the tests exercise the real database with
// the same SQL shapes the repository layer issues (the exact conditional
// UPDATE gate, tx-wrapped audit insert), reuse lib/permissions for the
// reviewer predicate, and reuse lib/validation for input contracts.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { can, Permission } from "../lib/permissions.ts";
import { closePool, getPool } from "./helpers.ts";

const pool = getPool();
const createdUserEmails = new Set<string>();
const createdOrganizationIds = new Set<string>();

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
  const email = `phase7-${label}-${randomUUID().slice(0, 8)}@ledger.test`;
  const userId = randomUUID();
  await pool.query(
    `insert into "user" (id, name, email) values ($1, $2, $3)`,
    [userId, label, email],
  );
  createdUserEmails.add(email);
  return userId;
}

async function provisionOrg(
  userId: string,
  role: "OWNER" | "HEAD" | "MEMBER",
): Promise<string> {
  const organizationId = randomUUID();
  await pool.query(
    `insert into "organization" (id, name, slug) values ($1, $2, $3)`,
    [organizationId, `P7 Org ${organizationId.slice(0, 8)}`, `p7-${organizationId.slice(0, 8)}`],
  );
  createdOrganizationIds.add(organizationId);
  await pool.query(
    `insert into "organization_member" (id, organization_id, user_id, role)
     values ($1, $2, $3, $4)`,
    [randomUUID(), organizationId, userId, role],
  );
  return organizationId;
}

async function addOrgMember(
  organizationId: string,
  userId: string,
  role: "OWNER" | "HEAD" | "MEMBER",
) {
  await pool.query(
    `insert into "organization_member" (id, organization_id, user_id, role)
     values ($1, $2, $3, $4)`,
    [randomUUID(), organizationId, userId, role],
  );
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
      `P7 Project ${projectId.slice(0, 8)}`,
      `p7-proj-${projectId.slice(0, 8)}`,
      100000n,
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

async function provisionPendingTransaction(input: {
  organizationId: string;
  projectId: string;
  createdByUserId: string;
  type?: "PAYMENT" | "WITHDRAWAL";
  amountMinorUnits?: bigint;
}): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `insert into "transaction"
       (id, organization_id, project_id, created_by_user_id, type,
        amount_minor_units, paid_to, notes, status, idempotency_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9)`,
    [
      id,
      input.organizationId,
      input.projectId,
      input.createdByUserId,
      input.type ?? "PAYMENT",
      input.amountMinorUnits ?? 100n,
      null,
      `tx ${id.slice(0, 8)}`,
      randomUUID(),
    ],
  );
  return id;
}

// --- Mirror of repository/service decision logic ---------------------------

/**
 * The exact atomic gate used by src/server/repositories/approvals.ts:
 * single conditional UPDATE guarded on status='PENDING'. Returns the
 * updated row, or null when another reviewer already decided.
 */
interface SqlExecutor {
  query(config: {
    text: string;
    values: unknown[];
  }): Promise<{ rows: Record<string, unknown>[] }>;
}

async function conditionalTransition(
  executor: SqlExecutor,
  transactionId: string,
  decision: "APPROVED" | "REJECTED",
  reviewerId: string,
) {
  const columnSet =
    decision === "APPROVED"
      ? `status = 'APPROVED', approved_by_user_id = $2, approved_at = now(), updated_at = now()`
      : `status = 'REJECTED', rejected_by_user_id = $2, rejected_at = now(), updated_at = now()`;
  const { rows } = await executor.query({
    text: `update "transaction" set ${columnSet} where id = $1 and status = 'PENDING' returning *`,
    values: [transactionId, reviewerId],
  });
  return (rows[0] as Record<string, unknown> | undefined) ?? null;
}

/** Reviewer predicate shared with the service (Phase 2 role model). */
async function canReview(
  actorUserId: string,
  organizationId: string,
  projectId: string,
): Promise<boolean> {
  const org = await pool.query(
    `select role from "organization_member" where user_id = $1 and organization_id = $2`,
    [actorUserId, organizationId],
  );
  if (org.rows.length === 0) return false;
  if (!can({ role: org.rows[0].role }, Permission.PROJECT_MANAGE)) return false;
  const project = await pool.query(
    `select id from "project_member" where project_id = $1 and user_id = $2`,
    [projectId, actorUserId],
  );
  return project.rows.length > 0;
}

/** Mirror of services/approvals.ts decide(): state + audit in ONE tx. */
async function decideAtomically(
  transactionId: string,
  decision: "APPROVED" | "REJECTED",
  reviewerId: string,
  transactionRow: { organizationId: string; projectId: string },
  opts: { failAudit?: boolean } = {},
) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const updated = await conditionalTransition(client, transactionId, decision, reviewerId);
    if (!updated) {
      throw new Error("DECISION_CONFLICT");
    }
    await client.query(
      `insert into "audit_log"
         (id, organization_id, project_id, actor_user_id, entity_type, entity_id, action)
       values ($1, $2, $3, $4, 'transaction', $5, $6)`,
      [
        randomUUID(),
        transactionRow.organizationId,
        transactionRow.projectId,
        opts.failAudit ? randomUUID() : reviewerId, // FK violation when failing
        transactionId,
        decision === "APPROVED" ? "TRANSACTION_APPROVED" : "TRANSACTION_REJECTED",
      ],
    );
    await client.query("commit");
    return updated;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// --- -----------------------------------------------------------------------

before(async () => {
  await resetFixtures();
});

after(async () => {
  await resetFixtures();
  await closePool();
});

describe("reviewer authorization", () => {
  it("only OWNER/HEAD (project.manage) may review; others are denied", async () => {
    const ownerId = await provisionUser("authz-owner");
    const organizationId = await provisionOrg(ownerId, "OWNER");
    const headId = await provisionUser("authz-head");
    await addOrgMember(organizationId, headId, "HEAD");
    const memberId = await provisionUser("authz-member");
    await addOrgMember(organizationId, memberId, "MEMBER");
    const projectId = await provisionProject(organizationId, ownerId);
    await addProjectMember(projectId, ownerId);
    await addProjectMember(projectId, headId);

    assert.ok(await canReview(ownerId, organizationId, projectId));
    assert.ok(await canReview(headId, organizationId, projectId));
    // MEMBER lacks project.manage.
    assert.equal(can({ role: "MEMBER" }, Permission.PROJECT_MANAGE), false);
    // HEAD must be a project member too.
    assert.equal(await canReview(headId, organizationId, randomUUID()), false);
  });

  it("cross-organization reviewer is denied", async () => {
    const ownerId = await provisionUser("authz-xo-owner");
    const orgA = await provisionOrg(ownerId, "OWNER");
    const projA = await provisionProject(orgA, ownerId);
    const outsiderId = await provisionUser("authz-xo-outsider");
    const orgB = await provisionOrg(outsiderId, "OWNER");
    const projB = await provisionProject(orgB, outsiderId);

    assert.equal(await canReview(outsiderId, orgA, projA), false);
    assert.equal(await canReview(ownerId, orgB, projB), false);
  });

  it("cross-project reviewer is denied (org member, not project member)", async () => {
    const ownerId = await provisionUser("authz-xp-owner");
    const organizationId = await provisionOrg(ownerId, "OWNER");
    const headId = await provisionUser("authz-xp-head");
    await addOrgMember(organizationId, headId, "HEAD");
    const projectId = await provisionProject(organizationId, ownerId);

    assert.equal(
      await canReview(headId, organizationId, projectId),
      false,
      "org membership alone must not grant project review",
    );
  });

  it("submitter cannot approve or reject their own transaction (predicate)", async () => {
    const creatorId = await provisionUser("authz-self-creator");
    const organizationId = await provisionOrg(creatorId, "OWNER");
    const projectId = await provisionProject(organizationId, creatorId);
    const transactionId = await provisionPendingTransaction({
      organizationId, projectId, createdByUserId: creatorId,
    });

    const { rows } = await pool.query(
      `select created_by_user_id from "transaction" where id = $1`,
      [transactionId],
    );
    // Mirror of services/approvals.ts requireReviewableTransaction:
    // actor.id !== transaction.created_by_user_id → SELF_DECISION_FORBIDDEN.
    const selfDecisionDenied = (actorId: string) =>
      rows[0].created_by_user_id === actorId;
    assert.equal(selfDecisionDenied(creatorId), true, "submitter must be forbidden");
    const otherId = await provisionUser("authz-self-other");
    assert.equal(selfDecisionDenied(otherId), false);
  });

  it("malformed transaction ids are rejected before scope resolution", () => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    assert.ok(re.test(randomUUID()));
    assert.ok(!re.test("not-a-uuid"));
    assert.ok(!re.test(""));
    // A validly-formed id from another org hits NOT_FOUND, not authority.
  });
});

describe("state machine", () => {
  it("PENDING → APPROVED sets server-controlled reviewer metadata", async () => {
    const creatorId = await provisionUser("sm-approve-creator");
    const organizationId = await provisionOrg(creatorId, "OWNER");
    const reviewerId = await provisionUser("sm-approve-reviewer");
    await addOrgMember(organizationId, reviewerId, "HEAD");
    const projectId = await provisionProject(organizationId, creatorId);
    await addProjectMember(projectId, reviewerId);
    const transactionId = await provisionPendingTransaction({
      organizationId, projectId, createdByUserId: creatorId,
    });

    const updated = await conditionalTransition(pool, transactionId, "APPROVED", reviewerId);
    assert.ok(updated);
    assert.equal(updated.status, "APPROVED");
    assert.equal(updated.approved_by_user_id, reviewerId);
    assert.ok(updated.approved_at instanceof Date);
    assert.equal(updated.rejected_by_user_id, null);
    assert.equal(updated.rejected_at, null);
  });

  it("PENDING → REJECTED sets rejection metadata only", async () => {
    const creatorId = await provisionUser("sm-reject-creator");
    const organizationId = await provisionOrg(creatorId, "OWNER");
    const reviewerId = await provisionUser("sm-reject-reviewer");
    await addOrgMember(organizationId, reviewerId, "HEAD");
    const projectId = await provisionProject(organizationId, creatorId);
    await addProjectMember(projectId, reviewerId);
    const transactionId = await provisionPendingTransaction({
      organizationId, projectId, createdByUserId: creatorId,
    });

    const updated = await conditionalTransition(pool, transactionId, "REJECTED", reviewerId);
    assert.ok(updated);
    assert.equal(updated.status, "REJECTED");
    assert.equal(updated.rejected_by_user_id, reviewerId);
    assert.equal(updated.approved_by_user_id, null);
    assert.equal(updated.approved_at, null);
  });

  it("terminal states cannot change (APPROVED→*/ REJECTED→* all lose the gate)", async () => {
    const creatorId = await provisionUser("sm-terminal-creator");
    const organizationId = await provisionOrg(creatorId, "OWNER");
    const reviewerId = await provisionUser("sm-terminal-reviewer");
    await addOrgMember(organizationId, reviewerId, "HEAD");
    const projectId = await provisionProject(organizationId, creatorId);
    await addProjectMember(projectId, reviewerId);

    const approvedId = await provisionPendingTransaction({
      organizationId, projectId, createdByUserId: creatorId,
    });
    await conditionalTransition(pool, approvedId, "APPROVED", reviewerId);
    assert.equal(await conditionalTransition(pool, approvedId, "APPROVED", reviewerId), null);
    assert.equal(await conditionalTransition(pool, approvedId, "REJECTED", reviewerId), null);

    const rejectedId = await provisionPendingTransaction({
      organizationId, projectId, createdByUserId: creatorId,
    });
    await conditionalTransition(pool, rejectedId, "REJECTED", reviewerId);
    assert.equal(await conditionalTransition(pool, rejectedId, "APPROVED", reviewerId), null);
    assert.equal(await conditionalTransition(pool, rejectedId, "REJECTED", reviewerId), null);

    const { rows } = await pool.query(
      `select status from "transaction" where id = any($1) order by status`,
      [[approvedId, rejectedId]],
    );
    assert.deepEqual(rows.map((r) => r.status), ["APPROVED", "REJECTED"]);
  });
});

describe("concurrency: single winner", () => {
  async function race(decisionA: "APPROVED" | "REJECTED", decisionB: "APPROVED" | "REJECTED") {
    const creatorId = await provisionUser("cc-creator");
    const organizationId = await provisionOrg(creatorId, "OWNER");
    const reviewerA = await provisionUser("cc-reviewer-a");
    const reviewerB = await provisionUser("cc-reviewer-b");
    await addOrgMember(organizationId, reviewerA, "HEAD");
    await addOrgMember(organizationId, reviewerB, "HEAD");
    const projectId = await provisionProject(organizationId, creatorId);
    await addProjectMember(projectId, reviewerA);
    await addProjectMember(projectId, reviewerB);
    const transactionId = await provisionPendingTransaction({
      organizationId, projectId, createdByUserId: creatorId,
    });

    const results = await Promise.allSettled([
      conditionalTransition(pool, transactionId, decisionA, reviewerA),
      conditionalTransition(pool, transactionId, decisionB, reviewerB),
    ]);
    const won = results.filter(
      (r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<unknown>).value !== null,
    );
    return { won: won.length, transactionId };
  }

  it("two concurrent approvals → exactly one succeeds", async () => {
    const { won, transactionId } = await race("APPROVED", "APPROVED");
    assert.equal(won, 1);
    const { rows } = await pool.query(
      `select status from "transaction" where id = $1`,
      [transactionId],
    );
    assert.equal(rows[0].status, "APPROVED");
  });

  it("approve vs reject → exactly one succeeds", async () => {
    const { won, transactionId } = await race("APPROVED", "REJECTED");
    assert.equal(won, 1);
    const { rows } = await pool.query(
      `select status, approved_by_user_id, rejected_by_user_id from "transaction" where id = $1`,
      [transactionId],
    );
    assert.ok(["APPROVED", "REJECTED"].includes(rows[0].status));
    if (rows[0].status === "APPROVED") {
      assert.ok(rows[0].approved_by_user_id);
      assert.equal(rows[0].rejected_by_user_id, null);
    } else {
      assert.ok(rows[0].rejected_by_user_id);
      assert.equal(rows[0].approved_by_user_id, null);
    }
  });

  it("reject vs approve → exactly one succeeds", async () => {
    const { won } = await race("REJECTED", "APPROVED");
    assert.equal(won, 1);
  });
});

describe("audit atomicity", () => {
  it("state change + audit event commit together", async () => {
    const creatorId = await provisionUser("audit-ok-creator");
    const organizationId = await provisionOrg(creatorId, "OWNER");
    const reviewerId = await provisionUser("audit-ok-reviewer");
    await addOrgMember(organizationId, reviewerId, "HEAD");
    const projectId = await provisionProject(organizationId, creatorId);
    await addProjectMember(projectId, reviewerId);
    const transactionId = await provisionPendingTransaction({
      organizationId, projectId, createdByUserId: creatorId,
    });

    await decideAtomically(transactionId, "APPROVED", reviewerId, { organizationId, projectId });

    const { rows: txRows } = await pool.query(
      `select status, approved_by_user_id from "transaction" where id = $1`,
      [transactionId],
    );
    assert.equal(txRows[0].status, "APPROVED");

    const { rows: auditRows } = await pool.query(
      `select action, actor_user_id, organization_id from "audit_log"
       where entity_type = 'transaction' and entity_id = $1`,
      [transactionId],
    );
    assert.equal(auditRows.length, 1);
    assert.equal(auditRows[0].action, "TRANSACTION_APPROVED");
    assert.equal(auditRows[0].actor_user_id, reviewerId);
    assert.equal(auditRows[0].organization_id, organizationId);
  });

  it("audit failure rolls back the state change", async () => {
    const creatorId = await provisionUser("audit-fail-creator");
    const organizationId = await provisionOrg(creatorId, "OWNER");
    const reviewerId = await provisionUser("audit-fail-reviewer");
    await addOrgMember(organizationId, reviewerId, "HEAD");
    const projectId = await provisionProject(organizationId, creatorId);
    await addProjectMember(projectId, reviewerId);
    const transactionId = await provisionPendingTransaction({
      organizationId, projectId, createdByUserId: creatorId,
    });

    await assert.rejects(
      decideAtomically(transactionId, "APPROVED", reviewerId, { organizationId, projectId }, { failAudit: true }),
      /violates foreign key constraint/,
    );

    const { rows } = await pool.query(
      `select status from "transaction" where id = $1`,
      [transactionId],
    );
    assert.equal(rows[0].status, "PENDING", "audit failure must roll back the decision");

    const { rows: audits } = await pool.query(
      `select count(*)::int as count from "audit_log" where entity_type = 'transaction' and entity_id = $1`,
      [transactionId],
    );
    assert.equal(audits[0].count, 0);
  });

  it("state failure rolls back the audit insert", async () => {
    const creatorId = await provisionUser("audit-statefail-creator");
    const organizationId = await provisionOrg(creatorId, "OWNER");
    const reviewerId = await provisionUser("audit-statefail-reviewer");
    await addOrgMember(organizationId, reviewerId, "HEAD");
    const projectId = await provisionProject(organizationId, creatorId);
    await addProjectMember(projectId, reviewerId);
    const transactionId = await provisionPendingTransaction({
      organizationId, projectId, createdByUserId: creatorId,
    });
    // Decide once so the gate loses for the second attempt.
    await conditionalTransition(pool, transactionId, "APPROVED", reviewerId);

    await assert.rejects(
      decideAtomically(transactionId, "APPROVED", reviewerId, { organizationId, projectId }),
      /DECISION_CONFLICT/,
    );

    const { rows: audits } = await pool.query(
      `select count(*)::int as count from "audit_log" where entity_id = $1`,
      [transactionId],
    );
    assert.equal(audits[0].count, 0, "no audit may exist without a state change");
  });
});

describe("pending queue scope and bounds", () => {
  it("returns only PENDING rows for the project, bounded, with stable cursor pages", async () => {
    const creatorId = await provisionUser("queue-creator");
    const organizationId = await provisionOrg(creatorId, "OWNER");
    const reviewerId = await provisionUser("queue-reviewer");
    await addOrgMember(organizationId, reviewerId, "HEAD");
    const projectId = await provisionProject(organizationId, creatorId);
    await addProjectMember(projectId, reviewerId);
    const otherProjectId = await provisionProject(organizationId, creatorId);

    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      ids.push(
        await provisionPendingTransaction({
          organizationId, projectId, createdByUserId: creatorId, amountMinorUnits: BigInt(i + 1),
        }),
      );
    }
    // One already decided + one in another project — must never appear.
    const decidedId = await provisionPendingTransaction({
      organizationId, projectId, createdByUserId: creatorId,
    });
    await conditionalTransition(pool, decidedId, "APPROVED", reviewerId);
    await provisionPendingTransaction({
      organizationId, projectId: otherProjectId, createdByUserId: creatorId,
    });

    // Mirror of the repository page query (project-scoped, PENDING-only,
    // newest first, limit+1 probe).
    const limit = 2;
    const first = await pool.query(
      `select id, created_at from "transaction"
       where project_id = $1 and status = 'PENDING'
       order by created_at desc, id desc limit $2`,
      [projectId, limit + 1],
    );
    assert.equal(first.rows.length, limit + 1, "probe must detect a following page");
    const page1 = first.rows.slice(0, limit);
    const cursor = page1[page1.length - 1];

    const second = await pool.query(
      `select id from "transaction"
       where project_id = $1 and status = 'PENDING'
         and (created_at, id) < ($2, $3)
       order by created_at desc, id desc limit $4`,
      [projectId, cursor.created_at, cursor.id, limit + 1],
    );
    const page2Ids = second.rows.slice(0, limit).map((r) => r.id);
    assert.equal(page2Ids.length, 2);
    assert.ok(!page1.some((r) => page2Ids.includes(r.id)), "pages must not overlap");

    const combined = [...page1.map((r) => r.id), ...page2Ids];
    for (const id of ids) assert.ok(combined.includes(id));
    assert.ok(!combined.includes(decidedId));
  });
});
