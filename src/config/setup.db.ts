import { Client } from "pg";

async function setupDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL as string,
  });
  try {
    await client.connect();
    console.log("🔗 Connected to database");

    await Promise.all([
      client.query("CREATE EXTENSION IF NOT EXISTS postgis;"),
      client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`),
      client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`),
      client.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`),
    ]);

    console.log("✅ PostGIS extension enabled");
    console.log("✅ UUID extension enabled");
    console.log("✅ pgcrypto extension enabled");
    console.log("✅ pg_trgm extension enabled");

    await client.end();
    console.log("✨ Database setup complete\n");
  } catch (error) {
    console.error("❌ Database setup failed:", error);
    process.exit(1);
  }
}

setupDatabase();
