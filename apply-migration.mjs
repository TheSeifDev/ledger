// Apply migration manually using pooled connection
import pg from "pg";
import { readFileSync } from "fs";

const sql = readFileSync("./src/db/migrations/0001_sparkling_miracleman.sql", "utf-8");

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL, // Use pooled connection
  max: 1 
});

async function applyMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Split by statement-breakpoint marker
    const statements = sql.split("--> statement-breakpoint").filter(s => s.trim());
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed) {
        console.log("Executing:", trimmed.substring(0, 80) + "...");
        await client.query(trimmed);
      }
    }
    
    await client.query("COMMIT");
    console.log("Migration applied successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch(() => process.exit(1));