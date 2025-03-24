import { fetchDBConfig } from "../config/dbConfig";
import { getTenant, ConnectVo } from "../context/tenantContext";
import { createPostgresConnection } from "./postgres";
import { createMySQLConnection } from "./mysql";
import { createMongoDBConnection } from "./mongodb";
import { createCassandraConnection } from "./cassandra";

const connectionCache: Map<string, { connection: any; dbType: string }> = new Map();

function generateCacheKey(appid: string, orgid: string, appdbname: string): string {
  return `${appid}-${orgid}-${appdbname}`;
}

/**
 * Retrieves the connection for the current tenant context.
 * Returns an object containing both the connection instance and the dbType.
 */
export async function getConnection(tenant?: ConnectVo): Promise<{ connection: any; dbType: string }> {
  const currentTenant: ConnectVo | undefined = tenant || getTenant();
  if (!currentTenant) {
    throw new Error("No tenant context available");
  }
  const { appid, orgid, appdbname } = currentTenant;
  const cacheKey = generateCacheKey(appid, orgid, appdbname);
  if (connectionCache.has(cacheKey)) {
    console.log(`[MultiBrige] Reusing connection for ${cacheKey}`);
    return connectionCache.get(cacheKey)!;
  }
  const dbConfig = await fetchDBConfig(appid, orgid);
  if (!dbConfig) {
    throw new Error(`No configuration found for appid: ${appid}, orgid: ${orgid}`);
  }
  const schema = appdbname || dbConfig.schema;
  let connection: any;
  let dbType: string = dbConfig.db_type;
  switch (dbType) {
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
  const ret = { connection, dbType };
  connectionCache.set(cacheKey, ret);
  return ret;
}

export async function closeConnection(tenant?: ConnectVo): Promise<void> {
  const currentTenant = tenant || getTenant();
  if (!currentTenant) return;
  const cacheKey = generateCacheKey(currentTenant.appid, currentTenant.orgid, currentTenant.appdbname);
  if (connectionCache.has(cacheKey)) {
    const { connection, dbType } = connectionCache.get(cacheKey)!;
    if (connection) {
      if ((dbType === "postgres" || dbType === "mysql") && connection.end) {
        await connection.end();
        console.log(`[MultiBridge] SQL connection closed for ${cacheKey}`);
      } else if (dbType === "mongodb" && connection.close) {
        await connection.close();
        console.log(`[MultiBridge] MongoDB connection closed for ${cacheKey}`);
      } else if (dbType === "cassandra" && connection.shutdown) {
        await connection.shutdown();
        console.log(`[MultiBridge] Cassandra connection closed for ${cacheKey}`);
      }
    }
    connectionCache.delete(cacheKey);
  }
}


export async function closeAllConnections(): Promise<void> {
  for (const [cacheKey, { connection, dbType }] of connectionCache.entries()) {
    if (connection) {
      if ((dbType === "postgres" || dbType === "mysql") && connection.end) {
        await connection.end();
        console.log(`[MultiBridge] SQL connection closed for ${cacheKey}`);
      } else if (dbType === "mongodb" && connection.close) {
        await connection.close();
        console.log(`[MultiBridge] MongoDB connection closed for ${cacheKey}`);
      } else if (dbType === "cassandra" && connection.shutdown) {
        await connection.shutdown();
        console.log(`[MultiBridge] Cassandra connection closed for ${cacheKey}`);
      }
    }
  }
  connectionCache.clear();
}