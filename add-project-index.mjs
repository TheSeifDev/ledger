// Add missing unique index on project table
import pg from "pg";

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1 
});

async function addMissingIndex() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Add unique index on project (organization_id, slug)
    console.log("Adding project_org_slug_unique index...");
    await client.query(`
      CREATE UNIQUE INDEX "project_org_slug_unique" ON "project" ("organization_id", "slug")
    `);
    
    await client.query("COMMIT");
    console.log("Index added successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Fix failed:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addMissingIndex().catch(() => process.exit(1));