import { runWithTenant, ConnectVo } from "../src/tenantContext";
import { getConnection, closeConnection } from "../src/connections/connectionManager";

async function main() {
  // Define tenant information
  const tenant: ConnectVo = {
    appid: "appA",
    orgid: "org123",
    appdbname: "schema4", // Target schema for the tenant
  };

  await runWithTenant(tenant, async () => {
    // Demonstrate connection reuse:
    const connection1 = await getConnection();
    console.log("Obtained connection (first call):", connection1);

    const connection2 = await getConnection();
    console.log("Obtained connection (second call):", connection2);

    if (connection1 === connection2) {
      console.log("✅ Connection is reused.");
    } else {
      console.log("❌ A new connection was created.");
    }
    // Clean up: close connection
    await closeConnection();
  });
}

main().catch((error) => console.error("Error:", error));
