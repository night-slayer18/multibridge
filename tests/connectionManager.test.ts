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

    const result = await pool.query("SELECT * FROM connection_config");
    console.log("Central DB query result:", result.rows);
    await pool.end();
  } catch (error) {
    console.error("Central DB connection test failed:", error);
  }
}

// Test fetching configuration from the central DB.
async function testFetchDBConfig() {
  try {
    const appId = "org123";
    const orgId = "appA";

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
async function testInternalConnection() {
  try {
    const appId = "org123";
    const orgId = "appA";

    const connection = await getConnection(appId, orgId);
    if (connection) {
      console.log("Internal connection established:", connection);
    } else {
      console.log("Internal connection not established.");
    }

    // Close the connection appropriately.
    if (connection && connection.end) {
      await connection.end(); // For SQL-based clients (PostgreSQL, MySQL)
      console.log("SQL connection closed.");
    } else if (connection && connection.close) {
      await connection.close(); // For MongoDB
      console.log("MongoDB connection closed.");
    } else if (connection && connection.shutdown) {
      await connection.shutdown(); // For Cassandra
      console.log("Cassandra connection closed.");
    }
  } catch (error) {
    console.error("Error establishing internal connection:", error);
  }
}

async function runTests() {
  console.log("==== Testing Central DB Connection ====");
  await testCentralDBConnection();

  console.log("\n==== Testing fetchDBConfig ====");
  await testFetchDBConfig();

  console.log("\n==== Testing Internal Connection (via Connection Manager) ====");
  await testInternalConnection();
}

runTests();
