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
import { LRUCache } from "../utils/lruCache";
import { RateLimiter } from "../utils/rateLimiter";
import { envConfig } from "../config/envConfig";
import {
  ConnectionError,
  TenantContextError,
  TimeoutError,
} from "../utils/errors";

interface ConnectionData {
  connection: AnyConnection;
  dbType: string;
  config?: { schema?: string };
  lastValidated?: number; // Timestamp of last validation
}

// LRU Cache for connections with configurable size and TTL
const connectionCache = new LRUCache<string, ConnectionData>(
  envConfig.CONNECTION_CACHE_MAX_SIZE,
  envConfig.CONNECTION_CACHE_TTL_MS || undefined
);

// Track in-flight connection creations to prevent race conditions
const pendingConnections = new Map<string, Promise<ConnectionData>>();

// Rate limiter to prevent excessive connection creation
const rateLimiter = new RateLimiter(
  envConfig.RATE_LIMIT_MAX_REQUESTS,
  envConfig.RATE_LIMIT_WINDOW_MS
);

function generateCacheKey(appid: string, orgid: string, appdbname: string): string {
  return `${appid}-${orgid}-${appdbname}`;
}

// Type guard to identify SQL pools
function isSQLPool(connection: AnyConnection): connection is PgPool | MySqlPool {
  return "query" in connection;
}

async function isSQLConnectionValid(connection: AnyConnection, cacheKey: string): Promise<boolean> {
  try {
    if (isSQLPool(connection)) {
      // Use explicit typing to help TypeScript with overload resolution
      if ("execute" in connection) {
        // MySQL pool
        await (connection as MySqlPool).query("SELECT 1");
      } else {
        // PostgreSQL pool
        await (connection as PgPool).query("SELECT 1");
      }
      return true;
    }
    return false;
  } catch (error) {
    logger.warn(`SQL connection validation failed for ${cacheKey}: ${(error as Error).message}`, {
      cacheKey,
      error: (error as Error).stack,
    });
    return false;
  }
}

async function isMongoConnectionValid(connection: AnyConnection, cacheKey: string): Promise<boolean> {
  try {
    await (connection as MongoConnection).client.db().admin().ping();
    return true;
  } catch (error) {
    logger.warn(`MongoDB connection validation failed for ${cacheKey}: ${(error as Error).message}`, {
      cacheKey,
      error: (error as Error).stack,
    });
    return false;
  }
}

async function isCassandraConnectionValid(connection: AnyConnection, cacheKey: string): Promise<boolean> {
  try {
    await (connection as CassandraClient).execute("SELECT release_version FROM system.local");
    return true;
  } catch (error) {
    logger.warn(`Cassandra connection validation failed for ${cacheKey}: ${(error as Error).message}`, {
      cacheKey,
      error: (error as Error).stack,
    });
    return false;
  }
}

async function isConnectionValid(cached: ConnectionData, cacheKey: string): Promise<boolean> {
  switch (cached.dbType) {
    case "postgres":
    case "mysql":
      return isSQLConnectionValid(cached.connection, cacheKey);
    case "mongodb":
      return isMongoConnectionValid(cached.connection, cacheKey);
    case "cassandra":
      return isCassandraConnectionValid(cached.connection, cacheKey);
    default:
      return true;
  }
}

/**
 * Check if connection needs validation based on TTL
 */
function needsValidation(cached: ConnectionData): boolean {
  if (!cached.lastValidated) {
    return true;
  }
  const validationTTL = envConfig.CONNECTION_VALIDATION_TTL_MS;
  if (validationTTL <= 0) {
    return false; // Validation disabled
  }
  return Date.now() - cached.lastValidated > validationTTL;
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
    logger.error(`Error closing connection for ${cacheKey}: ${(error as Error).message}`, {
      cacheKey,
      dbType,
      error: (error as Error).stack,
    });
  }
}

/**
 * Retry connection creation with exponential backoff
 */
async function _createConnectionWithRetry(
  dbConfig: CentralDBConfig,
  schema?: string,
  attempt: number = 1
): Promise<AnyConnection> {
  const maxAttempts = envConfig.CONNECTION_RETRY_ATTEMPTS;
  const baseDelay = envConfig.CONNECTION_RETRY_DELAY_MS;

  try {
    return await _createConnection(dbConfig, schema);
  } catch (error) {
    // Check if error is retryable
    const isRetryable = isRetryableError(error);
    
    if (!isRetryable || attempt >= maxAttempts) {
      throw error;
    }

    // Calculate exponential backoff delay
    const delay = baseDelay * Math.pow(2, attempt - 1);
    logger.warn(
      `Connection creation failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms: ${(error as Error).message}`,
      {
        attempt,
        maxAttempts,
        delay,
        dbType: dbConfig.db_type,
        error: (error as Error).stack,
      }
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
    return _createConnectionWithRetry(dbConfig, schema, attempt + 1);
  }
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = (error as Error).message?.toLowerCase() || "";
  const retryablePatterns = [
    "econnrefused",
    "etimedout",
    "timeout",
    "econnreset",
    "enotfound",
    "temporary",
    "retry",
    "connection",
  ];

  return retryablePatterns.some((pattern) => errorMessage.includes(pattern));
}

async function _createConnection(dbConfig: CentralDBConfig, schema?: string): Promise<AnyConnection> {
  const { db_type: dbType } = dbConfig;

  switch (dbType) {
    case "postgres":
    case "mysql":
      if (!schema) {
        throw new ConnectionError(`Database schema is required for connection type '${dbType}' but was not found.`, {
          dbType,
        });
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
        throw new ConnectionError(`'data_center' is required for Cassandra connections.`, {
          dbType,
        });
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
      throw new ConnectionError(`Unsupported database type: ${dbType}`, {
        dbType,
      });
  }
}

export async function getConnection(tenant?: ConnectVo): Promise<ConnectionData> {
  const currentTenant: ConnectVo | undefined = tenant || getTenant();
  if (!currentTenant) {
    throw new TenantContextError("No tenant context available");
  }

  const { appid, orgid, appdbname } = currentTenant;
  const cacheKey = generateCacheKey(appid, orgid, appdbname);

  // Check rate limit
  if (!rateLimiter.check(cacheKey)) {
    throw new ConnectionError(
      `Rate limit exceeded for connection creation. Max ${envConfig.RATE_LIMIT_MAX_REQUESTS} requests per ${envConfig.RATE_LIMIT_WINDOW_MS}ms`,
      { cacheKey, appid, orgid, appdbname }
    );
  }

  // Check if connection is being created (race condition prevention)
  const pending = pendingConnections.get(cacheKey);
  if (pending) {
    logger.debug(`[MultiBridge] Waiting for pending connection creation for ${cacheKey}`);
    return pending;
  }

  // Check cache
  const cached = connectionCache.get(cacheKey);
  if (cached) {
    // Lazy validation: only validate if needed
    if (!needsValidation(cached)) {
      logger.debug(`[MultiBridge] Reusing cached connection for ${cacheKey} (validation skipped)`);
      return cached;
    }

    // Validate connection
    if (await isConnectionValid(cached, cacheKey)) {
      // Update validation timestamp
      cached.lastValidated = Date.now();
      connectionCache.set(cacheKey, cached);
      logger.debug(`[MultiBridge] Reusing valid connection for ${cacheKey}`);
      return cached;
    } else {
      logger.warn(`[MultiBridge] Cached connection for ${cacheKey} is stale. Closing and recreating connection.`);
      await _closeAndLog(cached.connection, cached.dbType, cacheKey);
      connectionCache.delete(cacheKey);
    }
  }

  // Create new connection with race condition prevention
  const connectionPromise = (async (): Promise<ConnectionData> => {
    try {
      const dbConfig = await fetchDBConfig(appid, orgid);
      if (!dbConfig) {
        throw new ConnectionError(`No configuration found for appid: ${appid}, orgid: ${orgid}`, {
          appid,
          orgid,
        });
      }

      const schema = appdbname || dbConfig.schema;
      const connection = await _createConnectionWithRetry(dbConfig, schema);

      const ret: ConnectionData = {
        connection,
        dbType: dbConfig.db_type,
        config: { schema },
        lastValidated: Date.now(),
      };
      
      connectionCache.set(cacheKey, ret);
      logger.info(`[MultiBridge] Created new connection for ${cacheKey}`, {
        cacheKey,
        dbType: dbConfig.db_type,
        appid,
        orgid,
      });
      
      return ret;
    } finally {
      // Remove from pending connections
      pendingConnections.delete(cacheKey);
    }
  })();

  // Store pending connection to prevent duplicates
  pendingConnections.set(cacheKey, connectionPromise);
  
  return connectionPromise;
}

export async function closeConnection(tenant?: ConnectVo): Promise<void> {
  const currentTenant = tenant || getTenant();
  if (!currentTenant) return;
  
  const cacheKey = generateCacheKey(currentTenant.appid, currentTenant.orgid, currentTenant.appdbname);
  const cached = connectionCache.get(cacheKey);
  
  if (cached) {
    await _closeAndLog(cached.connection, cached.dbType, cacheKey);
    connectionCache.delete(cacheKey);
    rateLimiter.reset(cacheKey);
  }
}

export async function closeAllConnections(): Promise<void> {
  const entries: Array<[string, ConnectionData]> = [];
  const keys: string[] = [];
  for (const key of connectionCache.keys()) {
    keys.push(key);
  }
  for (const cacheKey of keys) {
    const data = connectionCache.get(cacheKey);
    if (data) {
      entries.push([cacheKey, data]);
    }
  }

  for (const [cacheKey, { connection, dbType }] of entries) {
    await _closeAndLog(connection, dbType, cacheKey);
  }
  
  connectionCache.clear();
  pendingConnections.clear();
  rateLimiter.clear();
  logger.info("[MultiBridge] All connections closed.");
}

/**
 * Get connection pool statistics for monitoring
 */
export function getConnectionStats(): {
  cachedConnections: number;
  pendingConnections: number;
  cacheMaxSize: number;
} {
  return {
    cachedConnections: connectionCache.size(),
    pendingConnections: pendingConnections.size,
    cacheMaxSize: envConfig.CONNECTION_CACHE_MAX_SIZE,
  };
}
