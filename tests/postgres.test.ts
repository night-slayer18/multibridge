import { Pool } from "pg";
import { envConfig } from "../src/config/envConfig";
import { fetchDBConfig } from "../src/config/dbConfig";
import { getConnection } from "../src/connections/connectionManager";

// Test the central PostgreSQL DB connection by executing a dummy query.
async function testCentralDBConnection() {
  try {
    const pool = new Pool({
      host: envConfig.CENTRAL_DB_HOST,
      port: envConfig.CENTRAL_DB_PORT,
      user: envConfig.CENTRAL_DB_USER,
      password: envConfig.CENTRAL_DB_PASSWORD,
      database: envConfig.CENTRAL_DB_NAME,
    });

    const result = await pool.query("SELECT * from connection_config");
    console.log("Central DB query result:", result.rows[0]);
    await pool.end();
  } catch (error) {
    console.error("Central DB connection test failed:", error);
  }
}

// Test fetching configuration from the central DB.
async function testFetchDBConfig() {
  try {
    const appId = "testApp";
    const orgId = "testOrg";

    const config = await fetchDBConfig(appId, orgId);
    if (config) {
      console.log("Fetched DB config:", config);
    } else {
      console.log(`No DB config found for appId: ${appId}, orgId: ${orgId}`);
    }
  } catch (error) {
    console.error("Error fetching DB config:", error);
  }
}

// Test the internal connection manager functionality.

async function runTests() {
  console.log("==== Testing Central DB Connection ====");
  await testCentralDBConnection();
}

runTests();
