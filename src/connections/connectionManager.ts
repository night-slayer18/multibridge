import { fetchDBConfig } from "../config/dbConfig";
import { getTenant, ConnectVo } from "../context/tenantContext";
import { createPostgresConnection } from "./postgres";
import { createMySQLConnection } from "./mysql";
import { createMongoDBConnection } from "./mongodb";
import { createCassandraConnection } from "./cassandra";
import logger from "../utils/loggers";

interface ConnectionData {
  connection: any;
  dbType: string;
  config?: { schema?: string };
}

const connectionCache: Map<string, ConnectionData> = new Map();

function generateCacheKey(appid: string, orgid: string, appdbname: string): string {
  return `${appid}-${orgid}-${appdbname}`;
}

async function isSQLConnectionValid(connection: any): Promise<boolean> {
  try {
    await connection.query("SELECT 1");
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Retrieves a tenant-specific connection.
 * Checks the cache for an existing connection and validates it.
 * If the cached connection is stale or missing, creates a new connection.
 */
export async function getConnection(tenant?: ConnectVo): Promise<ConnectionData> {
  const currentTenant: ConnectVo | undefined = tenant || getTenant();
  if (!currentTenant) {
    throw new Error("No tenant context available");
  }
  const { appid, orgid, appdbname } = currentTenant;
  const cacheKey = generateCacheKey(appid, orgid, appdbname);

  // Check if a connection is cached
  if (connectionCache.has(cacheKey)) {
    const cached = connectionCache.get(cacheKey)!;
    if (cached.dbType === "postgres" || cached.dbType === "mysql") {
      // Check if the SQL connection is still healthy
      const valid = await isSQLConnectionValid(cached.connection);
      if (valid) {
        logger.info(`[MultiBridge] Reusing valid connection for ${cacheKey}`);
        return cached;
      } else {
        logger.warn(`[MultiBridge] Cached SQL connection for ${cacheKey} is stale. Recreating connection.`);
        connectionCache.delete(cacheKey);
      }
    } else {
      // For MongoDB and Cassandra, we assume the connection is valid (you can add health checks as needed)
      logger.info(`[MultiBridge] Reusing connection for ${cacheKey}`);
      return cached;
    }
  }

  // No valid cached connection; fetch configuration from central DB
  const dbConfig = await fetchDBConfig(appid, orgid);
  if (!dbConfig) {
    throw new Error(`No configuration found for appid: ${appid}, orgid: ${orgid}`);
  }

  // Use tenant.appdbname if provided; otherwise, use the default schema from config
  const schema = appdbname || dbConfig.schema;
  let connection: any;
  const dbType: string = dbConfig.db_type;

  try {
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
  } catch (error) {
    logger.error(`Error creating connection for ${cacheKey}: ${(error as Error).message}`);
    throw error;
  }

  const ret: ConnectionData = { connection, dbType, config: { schema } };
  connectionCache.set(cacheKey, ret);
  logger.info(`[MultiBridge] Created new connection for ${cacheKey}`);
  return ret;
}

export async function closeConnection(tenant?: ConnectVo): Promise<void> {
  const currentTenant = tenant || getTenant();
  if (!currentTenant) return;
  const cacheKey = generateCacheKey(currentTenant.appid, currentTenant.orgid, currentTenant.appdbname);
  if (connectionCache.has(cacheKey)) {
    const { connection, dbType } = connectionCache.get(cacheKey)!;
    if (connection) {
      try {
        if ((dbType === "postgres" || dbType === "mysql") && connection.end) {
          await connection.end();
          logger.info(`[MultiBridge] SQL connection closed for ${cacheKey}`);
        } else if (dbType === "mongodb" && connection.close) {
          await connection.close();
          logger.info(`[MultiBridge] MongoDB connection closed for ${cacheKey}`);
        } else if (dbType === "cassandra" && connection.shutdown) {
          await connection.shutdown();
          logger.info(`[MultiBridge] Cassandra connection closed for ${cacheKey}`);
        } else {
          logger.warn(`[MultiBridge] Unknown DB type or close method missing for ${cacheKey}`);
        }
      } catch (error) {
        logger.error(`Error closing connection for ${cacheKey}: ${(error as Error).message}`);
      }
    }
    connectionCache.delete(cacheKey);
  }
}


export async function closeAllConnections(): Promise<void> {
  for (const [cacheKey, { connection, dbType }] of connectionCache.entries()) {
    if (connection) {
      try {
        if ((dbType === "postgres" || dbType === "mysql") && connection.end) {
          await connection.end();
          logger.info(`[MultiBridge] SQL connection closed for ${cacheKey}`);
        } else if (dbType === "mongodb" && connection.close) {
          await connection.close();
          logger.info(`[MultiBridge] MongoDB connection closed for ${cacheKey}`);
        } else if (dbType === "cassandra" && connection.shutdown) {
          await connection.shutdown();
          logger.info(`[MultiBridge] Cassandra connection closed for ${cacheKey}`);
        } else {
          logger.warn(`[MultiBridge] Unknown DB type or close method missing for ${cacheKey}`);
        }
      } catch (error) {
        logger.error(`Error closing connection for ${cacheKey}: ${(error as Error).message}`);
      }
    }
  }
  connectionCache.clear();
  logger.info("[MultiBridge] All connections closed.");
}