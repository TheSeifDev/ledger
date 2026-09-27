// Fix project table - add missing columns
import pg from "pg";

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1 
});

async function fixProjectTable() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Add name column
    console.log("Adding project.name column...");
    await client.query(`
      ALTER TABLE "project" ADD COLUMN "name" text NOT NULL DEFAULT ''
    `);
    
    // Add slug column
    console.log("Adding project.slug column...");
    await client.query(`
      ALTER TABLE "project" ADD COLUMN "slug" text NOT NULL DEFAULT ''
    `);
    
    // Remove defaults
    await client.query(`ALTER TABLE "project" ALTER COLUMN "name" DROP DEFAULT`);
    await client.query(`ALTER TABLE "project" ALTER COLUMN "slug" DROP DEFAULT`);
    
    await client.query("COMMIT");
    console.log("Project table fixed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Fix failed:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixProjectTable().catch(() => process.exit(1));