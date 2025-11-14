/**
 * TypeORM adapter for MultiBridge
 * Supports: PostgreSQL, MySQL, MongoDB, Cassandra
 */

import { DataSource, DataSourceOptions } from "typeorm";
import { getTenantConnection, getTenantDBConfig, validateORMSupport } from "./base";
import { DBType } from "../types/dbTypes";
import { Pool as PgPool } from "pg";
import { Pool as MySqlPool } from "mysql2/promise";
import { MongoConnection } from "../connections/mongodb";
import { Client as CassandraClient } from "cassandra-driver";
import { ORMInstance } from "./types";
import logger from "../utils/loggers";
import { ConnectionError } from "../utils/errors";

// Cache for TypeORM DataSource instances per tenant
const typeormDataSources = new Map<string, DataSource>();

/**
 * Get or create a TypeORM DataSource for the current tenant
 * 
 * @param options - TypeORM DataSource options (entities, migrations, etc.)
 * @returns TypeORM DataSource instance configured for the current tenant
 * 
 * @example
 * ```typescript
 * await runWithTenant(tenant, async () => {
 *   const dataSource = await getTypeORMDataSource({
 *     entities: [User, Order],
 *   });
 *   const userRepo = dataSource.getRepository(User);
 *   await userRepo.find();
 * });
 * ```
 */
export async function getTypeORMDataSource(
  options?: Partial<DataSourceOptions>
): Promise<DataSource> {
  const { tenant, connectionData, dbType } = await getTenantConnection();
  
  // Validate database type
  validateORMSupport(dbType, ["postgres", "mysql", "mongodb", "cassandra"]);
  
  const cacheKey = `${tenant.appid}-${tenant.orgid}-${tenant.appdbname}`;
  
  // Check cache
  const cached = typeormDataSources.get(cacheKey);
  if (cached && cached.isInitialized) {
    logger.debug(`Reusing cached TypeORM DataSource for ${cacheKey}`);
    return cached;
  }
  
  // Get database configuration for connection details
  const { dbConfig } = await getTenantDBConfig();
  
  // Build DataSource options based on database type
  let dataSourceOptions: DataSourceOptions;
  
  if (dbType === "postgres") {
    const schema = connectionData.config?.schema || tenant.appdbname;
    
    dataSourceOptions = {
      type: "postgres",
      host: dbConfig.host,
      port: dbConfig.port,
      username: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.database,
      schema: schema,
      extra: {
        ...options?.extra,
      },
      synchronize: false, // Never auto-sync in production
      logging: options?.logging || false,
      ...options,
    } as DataSourceOptions;
  } else if (dbType === "mysql") {
    const database = tenant.appdbname;
    
    dataSourceOptions = {
      type: "mysql",
      host: dbConfig.host,
      port: dbConfig.port,
      username: dbConfig.username,
      password: dbConfig.password,
      database: database,
      extra: {
        ...options?.extra,
      },
      synchronize: false,
      logging: options?.logging || false,
      ...options,
    } as DataSourceOptions;
  } else if (dbType === "mongodb") {
    const database = tenant.appdbname;
    
    // Build MongoDB connection string
    let mongoUrl: string;
    if (dbConfig.host.endsWith(".mongodb.net")) {
      // MongoDB Atlas (Cluster) using SRV
      mongoUrl = `mongodb+srv://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}/${database}?authSource=admin`;
    } else {
      // Self-hosted MongoDB (Local/Remote)
      mongoUrl = `mongodb://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${database}?authSource=admin`;
    }
    
    dataSourceOptions = {
      type: "mongodb",
      url: mongoUrl,
      database: database,
      synchronize: false,
      logging: options?.logging || false,
      ...options,
    } as DataSourceOptions;
  } else if (dbType === "cassandra") {
    // TypeORM doesn't natively support Cassandra
    // This would require a custom driver
    throw new ConnectionError(
      "TypeORM does not natively support Cassandra. Consider using the Cassandra driver directly or a Cassandra-specific ORM.",
      { dbType }
    );
  } else {
    throw new ConnectionError(`Unsupported database type for TypeORM: ${dbType}`, {
      dbType,
    });
  }
  
  // Create and initialize DataSource
  const dataSource = new DataSource(dataSourceOptions);
  
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  
  // Cache the instance
  typeormDataSources.set(cacheKey, dataSource);
  
  logger.info(`Created TypeORM DataSource for ${cacheKey}`, {
    dbType,
    schema: connectionData.config?.schema,
  });
  
  return dataSource;
}

/**
 * Close TypeORM DataSource for a specific tenant
 */
export async function closeTypeORMDataSource(
  tenant?: { appid: string; orgid: string; appdbname: string }
): Promise<void> {
  if (!tenant) {
    const { tenant: currentTenant } = await getTenantConnection();
    tenant = currentTenant;
  }
  
  const cacheKey = `${tenant.appid}-${tenant.orgid}-${tenant.appdbname}`;
  const dataSource = typeormDataSources.get(cacheKey);
  
  if (dataSource && dataSource.isInitialized) {
    await dataSource.destroy();
    typeormDataSources.delete(cacheKey);
    logger.debug(`Closed TypeORM DataSource for ${cacheKey}`);
  }
}

/**
 * Close all TypeORM DataSources
 */
export async function closeAllTypeORMDataSources(): Promise<void> {
  const closePromises = Array.from(typeormDataSources.values())
    .filter((ds) => ds.isInitialized)
    .map((ds) =>
      ds.destroy().catch((error: Error) => {
        logger.warn(`Error closing TypeORM DataSource: ${error.message}`);
      })
    );
  
  await Promise.all(closePromises);
  typeormDataSources.clear();
  logger.info("All TypeORM DataSources closed");
}

