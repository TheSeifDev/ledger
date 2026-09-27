// Fix database schema to match our definitions
import pg from "pg";

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1 
});

async function fixSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // 1. Create the role enum type
    console.log("Creating role enum type...");
    await client.query(`CREATE TYPE "role" AS ENUM('OWNER', 'HEAD', 'MEMBER')`);
    
    // 2. Change organization_member.role to use the enum type
    console.log("Altering organization_member.role to use role enum...");
    await client.query(`
      ALTER TABLE "organization_member" 
      ALTER COLUMN "role" TYPE "role" USING "role"::"role"
    `);
    
    // 3. Drop the role column from project_member (not in spec)
    console.log("Dropping project_member.role column...");
    await client.query(`
      ALTER TABLE "project_member" DROP COLUMN IF EXISTS "role"
    `);
    
    await client.query("COMMIT");
    console.log("Schema fixes applied successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Schema fix failed:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixSchema().catch(() => process.exit(1));