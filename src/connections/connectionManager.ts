import { fetchDBConfig } from "../config/dbConfig";
import { getTenant, ConnectVo } from "../tenantContext";
import { createPostgresConnection } from "./postgres";
import { createMySQLConnection } from "./mysql";
import { createMongoDBConnection } from "./mongodb";
import { createCassandraConnection } from "./cassandra";

const connectionCache: Map<string, any> = new Map();

function generateCacheKey(appid: string, orgid: string, appdbname: string): string {
  return `${appid}-${orgid}-${appdbname}`;
}

/**
 * Returns a connection for the current tenant context.
 * If a connection is cached, it is reused.
 */
export async function getConnection(tenant?: ConnectVo): Promise<any> {
  const currentTenant: ConnectVo | undefined = tenant || getTenant();
  if (!currentTenant) {
    throw new Error("No tenant context available");
  }
  const { appid, orgid, appdbname } = currentTenant;
  const cacheKey = generateCacheKey(appid, orgid, appdbname);
  if (connectionCache.has(cacheKey)) {
    console.log(`[MultiBrige] Reusing connection for ${cacheKey}`);
    return connectionCache.get(cacheKey);
  }
  // Fetch configuration from the central DB
  const dbConfig = await fetchDBConfig(appid, orgid);
  if (!dbConfig) {
    throw new Error(`No configuration found for appid: ${appid}, orgid: ${orgid}`);
  }
  // Determine schema: use tenant.appdbname if provided, else fallback to default from central config.
  const schema = appdbname || dbConfig.schema;
  let connection: any;
  switch (dbConfig.db_type) {
    case "postgres":
      connection = await createPostgresConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        schema,
      });
      break;
    case "mysql":
      connection = await createMySQLConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        schema,
      });
      break;
    case "mongodb":
      connection = await createMongoDBConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
      });
      break;
    case "cassandra":
      connection = await createCassandraConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        dataCenter: dbConfig.data_center,
      });
      break;
    default:
      throw new Error(`Unsupported database type: ${dbConfig.db_type}`);
  }
  connectionCache.set(cacheKey, connection);
  return connection;
}

/**
 * Closes the connection for the current tenant.
 */
export async function closeConnection(tenant?: ConnectVo) {
  const currentTenant = tenant || getTenant();
  if (!currentTenant) return;
  const cacheKey = generateCacheKey(currentTenant.appid, currentTenant.orgid, currentTenant.appdbname);
  if (connectionCache.has(cacheKey)) {
    const connection = connectionCache.get(cacheKey);
    if (connection && connection.end) {
      await connection.end();
      console.log(`[MultiBridge] Connection closed for ${cacheKey}`);
    }
    connectionCache.delete(cacheKey);
  }
}

export async function closeAllConnections() {
  for (const [cacheKey, connection] of connectionCache) {
    if (connection && connection.end) {
      await connection.end();
      console.log(`[MultiBridge] Connection closed for ${cacheKey}`);
    }
  }
  connectionCache.clear();
}