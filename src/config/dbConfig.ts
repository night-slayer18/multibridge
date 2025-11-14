import { Pool } from "pg";
import { envConfig } from "./envConfig";
import logger from "../utils/loggers";
import { CentralDBConfig } from "../types/dbTypes";
import { LRUCache } from "../utils/lruCache";
import { ConfigurationError } from "../utils/errors";

const centralDB = new Pool({
  host: envConfig.CENTRAL_DB_HOST,
  port: envConfig.CENTRAL_DB_PORT,
  user: envConfig.CENTRAL_DB_USER,
  password: envConfig.CENTRAL_DB_PASSWORD,
  database: envConfig.CENTRAL_DB_NAME,
});

// Cache for DB config lookups
const configCache = new LRUCache<string, CentralDBConfig>(
  1000, // Max 1000 cached configs
  envConfig.CONFIG_CACHE_TTL_MS || undefined
);

function generateConfigCacheKey(appId: string, orgId: string): string {
  return `${appId}:${orgId}`;
}

export async function fetchDBConfig(appId: string, orgId: string): Promise<CentralDBConfig | null> {
  const cacheKey = generateConfigCacheKey(appId, orgId);
  
  // Check cache first
  const cached = configCache.get(cacheKey);
  if (cached) {
    logger.debug(`Using cached config for appid: ${appId}, orgid: ${orgId}`);
    return cached;
  }

  try {
    const tableName = envConfig.CENTRAL_DB_TABLE;
    if (!tableName) {
      throw new ConfigurationError("CENTRAL_DB_TABLE is not set in the environment");
    }
    // Ensure tableName is a safe SQL identifier (alphanumeric and underscores)
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new ConfigurationError("CENTRAL_DB_TABLE contains invalid characters");
    }
    const query = `SELECT * FROM ${tableName} WHERE app_id = $1 AND org_id = $2`;
    const result = await centralDB.query(query, [appId, orgId]);
    if (result.rows.length === 0) {
      logger.error(`No connection config found for app ${appId} and org ${orgId} in the DB`);
      return null;
    }
    const config = result.rows[0] as CentralDBConfig;
    
    // Cache the result
    configCache.set(cacheKey, config);
    
    logger.info(`Fetched configuration for appid: ${appId}, orgid: ${orgId}`);
    return config;
  } catch (error) {
    logger.error(`Error fetching DB config: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`, {
      appId,
      orgId,
    });
    throw error;
  }
}

/**
 * Invalidate cached config for a specific tenant
 */
export function invalidateConfigCache(appId: string, orgId: string): void {
  const cacheKey = generateConfigCacheKey(appId, orgId);
  configCache.delete(cacheKey);
  logger.debug(`Invalidated config cache for appid: ${appId}, orgid: ${orgId}`);
}

/**
 * Clear all cached configs
 */
export function clearConfigCache(): void {
  configCache.clear();
  logger.debug("Cleared all config cache");
}

/**
 * Close the central database pool
 * Should be called during graceful shutdown
 */
export async function closeCentralDB(): Promise<void> {
  try {
    await centralDB.end();
    logger.info("Central database pool closed");
  } catch (error) {
    logger.error(`Error closing central database pool: ${(error as Error).message}`);
    throw error;
  }
}