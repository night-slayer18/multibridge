import { getPostgresConnection } from "./postgres";
import { getMySQLConnection } from "./mysql";
import { getMongoDBConnection } from "./mongodb";
import { getCassandraConnection } from "./cassandra";
import { fetchDBConfig } from "../config/dbConfig";

const connectionCache: Map<string, any> = new Map();

function generateCacheKey(appId: string, orgId: string, appDbName?: string): string {
  return `${appId}-${orgId}-${appDbName || "default"}`;
}

export async function getConnection(appId: string, orgId: string, appDbName?: string) {
  const cacheKey = generateCacheKey(appId, orgId, appDbName);
  if (connectionCache.has(cacheKey)) {
    return connectionCache.get(cacheKey);
  }

  const dbConfig = await fetchDBConfig(appId, orgId);
  if (!dbConfig) throw new Error("No database configuration found.");

  const { dbType, host, port, username, password, database, defaultSchema } = dbConfig;
  const schema = appDbName || defaultSchema;

  let connection;
  switch (dbType) {
    case "postgres":
      connection = await getPostgresConnection({ host, port, username, password, database, schema });
      break;
    case "mysql":
      connection = await getMySQLConnection({ host, port, username, password, database, schema });
      break;
    case "mongodb":
      connection = await getMongoDBConnection({ host, port, username, password, database });
      break;
    case "cassandra":
      connection = await getCassandraConnection({ host, port, username, password, database });
      break;
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }

  connectionCache.set(cacheKey, connection);
  return connection;
}

export async function closeConnection(appId: string, orgId: string, appDbName?: string) {
  const cacheKey = generateCacheKey(appId, orgId, appDbName);
  if (connectionCache.has(cacheKey)) {
    const connection = connectionCache.get(cacheKey);
    await connection.close();
    connectionCache.delete(cacheKey);
  }
}

export async function closeAllConnections() {
  for (const [key, connection] of connectionCache.entries()) {
    await connection.close();
    connectionCache.delete(key);
  }
}