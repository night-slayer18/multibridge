/**
 * Sequelize ORM adapter for MultiBridge
 * Supports: PostgreSQL, MySQL
 */

import { Sequelize, Options } from "sequelize";
import { getTenantConnection, validateORMSupport } from "./base";
import { DBType } from "../types/dbTypes";
import { Pool as PgPool } from "pg";
import { Pool as MySqlPool } from "mysql2/promise";
import { ORMInstance } from "./types";
import logger from "../utils/loggers";
import { ConnectionError } from "../utils/errors";

// Cache for Sequelize instances per tenant
const sequelizeInstances = new Map<string, Sequelize>();

/**
 * Get or create a Sequelize instance for the current tenant
 * 
 * @param options - Optional Sequelize configuration options
 * @returns Sequelize instance configured for the current tenant
 * 
 * @example
 * ```typescript
 * await runWithTenant(tenant, async () => {
 *   const sequelize = await getSequelizeInstance();
 *   const User = sequelize.define('User', { ... });
 *   await User.findAll();
 * });
 * ```
 */
export async function getSequelizeInstance(options?: Partial<Options>): Promise<Sequelize> {
  const { tenant, connectionData, dbType } = await getTenantConnection();
  
  // Validate database type
  validateORMSupport(dbType, ["postgres", "mysql"]);
  
  const cacheKey = `${tenant.appid}-${tenant.orgid}-${tenant.appdbname}`;
  
  // Check cache
  const cached = sequelizeInstances.get(cacheKey);
  if (cached) {
    logger.debug(`Reusing cached Sequelize instance for ${cacheKey}`);
    return cached;
  }
  
  // Create Sequelize instance based on database type
  let sequelize: Sequelize;
  
  if (dbType === "postgres") {
    const pool = connectionData.connection as PgPool;
    const schema = connectionData.config?.schema || tenant.appdbname;
    
    sequelize = new Sequelize({
      dialect: "postgres",
      pool: pool as any, // Use MultiBridge's pool
      schema: schema,
      logging: options?.logging || false,
      define: {
        schema: schema,
        ...options?.define,
      },
      ...options,
    });
  } else if (dbType === "mysql") {
    const pool = connectionData.connection as MySqlPool;
    const database = tenant.appdbname;
    
    sequelize = new Sequelize({
      dialect: "mysql",
      pool: pool as any, // Use MultiBridge's pool
      database: database,
      logging: options?.logging || false,
      ...options,
    });
  } else {
    throw new ConnectionError(`Unsupported database type for Sequelize: ${dbType}`, {
      dbType,
    });
  }
  
  // Cache the instance
  sequelizeInstances.set(cacheKey, sequelize);
  
  logger.info(`Created Sequelize instance for ${cacheKey}`, {
    dbType,
    schema: connectionData.config?.schema,
  });
  
  return sequelize;
}

/**
 * Close Sequelize instance for a specific tenant
 */
export async function closeSequelizeInstance(tenant?: { appid: string; orgid: string; appdbname: string }): Promise<void> {
  if (!tenant) {
    const { tenant: currentTenant } = await getTenantConnection();
    tenant = currentTenant;
  }
  
  const cacheKey = `${tenant.appid}-${tenant.orgid}-${tenant.appdbname}`;
  const instance = sequelizeInstances.get(cacheKey);
  
  if (instance) {
    await instance.close();
    sequelizeInstances.delete(cacheKey);
    logger.debug(`Closed Sequelize instance for ${cacheKey}`);
  }
}

/**
 * Close all Sequelize instances
 */
export async function closeAllSequelizeInstances(): Promise<void> {
  const closePromises = Array.from(sequelizeInstances.values()).map((instance) =>
    instance.close().catch((error) => {
      logger.warn(`Error closing Sequelize instance: ${(error as Error).message}`);
    })
  );
  
  await Promise.all(closePromises);
  sequelizeInstances.clear();
  logger.info("All Sequelize instances closed");
}

