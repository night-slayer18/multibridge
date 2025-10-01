import { fetchDBConfig } from "../config/dbConfig";
import { getTenant, ConnectVo } from "../context/tenantContext";
import { createPostgresConnection } from "./postgres";
import { createMySQLConnection } from "./mysql";
import { createMongoDBConnection, MongoConnection } from "./mongodb";
import { createCassandraConnection } from "./cassandra";
import logger from "../utils/loggers";
import { AnyConnection, CentralDBConfig } from "../types/dbTypes";
import { Pool as PgPool } from "pg";
import { Pool as MySqlPool } from "mysql2/promise";
import { Client as CassandraClient } from "cassandra-driver";

interface ConnectionData {
  connection: AnyConnection;
  dbType: string;
  config?: { schema?: string };
}

const connectionCache: Map<string, ConnectionData> = new Map();

function generateCacheKey(appid: string, orgid: string, appdbname: string): string {
  return `${appid}-${orgid}-${appdbname}`;
}

// Stricter type guard to identify SQL pools that have a `query` method.
function isSQLPool(connection: AnyConnection): connection is PgPool | MySqlPool {
  return "query" in connection;
}

async function isSQLConnectionValid(connection: AnyConnection): Promise<boolean> {
  try {
    if (isSQLPool(connection)) {
      if ("execute" in connection) {
        await connection.query("SELECT 1");
      } else {
        await connection.query("SELECT 1");
      }
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function isMongoConnectionValid(connection: AnyConnection): Promise<boolean> {
  try {
    await (connection as MongoConnection).client.db().admin().ping();
    return true;
  } catch (error) {
    return false;
  }
}

async function isCassandraConnectionValid(connection: AnyConnection): Promise<boolean> {
  try {
    await (connection as CassandraClient).execute("SELECT release_version FROM system.local");
    return true;
  } catch (error) {
    return false;
  }
}

async function isConnectionValid(cached: ConnectionData): Promise<boolean> {
  switch (cached.dbType) {
    case "postgres":
    case "mysql":
      return isSQLConnectionValid(cached.connection);
    case "mongodb":
      return isMongoConnectionValid(cached.connection);
    case "cassandra":
      return isCassandraConnectionValid(cached.connection);
    default:
      return true;
  }
}

async function _closeAndLog(connection: AnyConnection, dbType: string, cacheKey: string): Promise<void> {
  try {
    switch (dbType) {
      case "postgres":
      case "mysql":
        await (connection as PgPool | MySqlPool).end();
        logger.info(`[MultiBridge] SQL connection closed for ${cacheKey}`);
        break;
      case "mongodb":
        await (connection as MongoConnection).client.close();
        logger.info(`[MultiBridge] MongoDB connection closed for ${cacheKey}`);
        break;
      case "cassandra":
        await (connection as CassandraClient).shutdown();
        logger.info(`[MultiBridge] Cassandra connection closed for ${cacheKey}`);
        break;
      default:
        logger.warn(`[MultiBridge] Unknown DB type or close method missing for ${cacheKey}`);
    }
  } catch (error) {
    logger.error(`Error closing connection for ${cacheKey}: ${(error as Error).message}`);
  }
}

async function _createConnection(dbConfig: CentralDBConfig, schema?: string): Promise<AnyConnection> {
  const { db_type: dbType } = dbConfig;

  switch (dbType) {
    case "postgres":
    case "mysql":
      if (!schema) {
        throw new Error(`Database schema is required for connection type '${dbType}' but was not found.`);
      }
      const sqlConfig = {
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        schema: schema,
      };
      return dbType === "postgres" ? createPostgresConnection(sqlConfig) : createMySQLConnection(sqlConfig);

    case "mongodb":
      return createMongoDBConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
      });

    case "cassandra":
      if (!dbConfig.data_center) {
        throw new Error(`'data_center' is required for Cassandra connections.`);
      }
      return createCassandraConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        dataCenter: dbConfig.data_center,
      });

    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

export async function getConnection(tenant?: ConnectVo): Promise<ConnectionData> {
  const currentTenant: ConnectVo | undefined = tenant || getTenant();
  if (!currentTenant) {
    throw new Error("No tenant context available");
  }
  const { appid, orgid, appdbname } = currentTenant;
  const cacheKey = generateCacheKey(appid, orgid, appdbname);

  if (connectionCache.has(cacheKey)) {
    const cached = connectionCache.get(cacheKey)!;
    if (await isConnectionValid(cached)) {
      logger.info(`[MultiBridge] Reusing valid connection for ${cacheKey}`);
      return cached;
    } else {
      logger.warn(`[MultiBridge] Cached connection for ${cacheKey} is stale. Closing and recreating connection.`);
      await _closeAndLog(cached.connection, cached.dbType, cacheKey);
      connectionCache.delete(cacheKey);
    }
  }

  const dbConfig = await fetchDBConfig(appid, orgid);
  if (!dbConfig) {
    throw new Error(`No configuration found for appid: ${appid}, orgid: ${orgid}`);
  }

  const schema = appdbname || dbConfig.schema;
  const connection = await _createConnection(dbConfig, schema);

  const ret: ConnectionData = { connection, dbType: dbConfig.db_type, config: { schema } };
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
    await _closeAndLog(connection, dbType, cacheKey);
    connectionCache.delete(cacheKey);
  }
}

export async function closeAllConnections(): Promise<void> {
  for (const [cacheKey, { connection, dbType }] of connectionCache.entries()) {
    await _closeAndLog(connection, dbType, cacheKey);
  }
  connectionCache.clear();
  logger.info("[MultiBridge] All connections closed.");
}