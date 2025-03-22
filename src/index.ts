import { getConnection, closeConnection, closeAllConnections } from "./connections/connectionManager";

export { getConnection, closeConnection, closeAllConnections };

process.on("SIGINT", async () => {
  console.log("\n[NexusConnect] SIGINT received. Closing connections...");
  await closeAllConnections();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[NexusConnect] SIGTERM received. Closing connections...");
  await closeAllConnections();
  process.exit(0);
});