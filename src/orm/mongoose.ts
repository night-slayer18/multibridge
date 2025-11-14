/**
 * Mongoose adapter for MultiBridge
 * Supports: MongoDB
 */

import mongoose, { Connection, ConnectOptions } from "mongoose";
import { getTenantConnection, getTenantDBConfig, validateORMSupport } from "./base";
import { DBType } from "../types/dbTypes";
import { MongoConnection } from "../connections/mongodb";
import logger from "../utils/loggers";
import { ConnectionError } from "../utils/errors";

// Cache for Mongoose connections per tenant
const mongooseConnections = new Map<string, Connection>();

/**
 * Get or create a Mongoose connection for the current tenant
 * 
 * @param options - Optional Mongoose connection options
 * @returns Mongoose connection instance configured for the current tenant
 * 
 * @example
 * ```typescript
 * await runWithTenant(tenant, async () => {
 *   const connection = await getMongooseConnection();
 *   const User = connection.model('User', userSchema);
 *   await User.find();
 * });
 * ```
 */
export async function getMongooseConnection(
  options?: ConnectOptions
): Promise<Connection> {
  const { tenant, connectionData, dbType } = await getTenantConnection();
  
  // Validate database type
  validateORMSupport(dbType, ["mongodb"]);
  
  const cacheKey = `${tenant.appid}-${tenant.orgid}-${tenant.appdbname}`;
  
  // Check cache
  const cached = mongooseConnections.get(cacheKey);
  if (cached && cached.readyState === 1) {
    logger.debug(`Reusing cached Mongoose connection for ${cacheKey}`);
    return cached;
  }
  
  // Get database configuration to build connection string
  const { dbConfig } = await getTenantDBConfig();
  const database = tenant.appdbname;
  
  // Build MongoDB connection string from config
  let connectionString: string;
  if (dbConfig.host.endsWith(".mongodb.net")) {
    // MongoDB Atlas (Cluster) using SRV
    connectionString = `mongodb+srv://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}/${database}?authSource=admin`;
  } else {
    // Self-hosted MongoDB (Local/Remote)
    connectionString = `mongodb://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${database}?authSource=admin`;
  }
  
  // Create Mongoose connection
  const mongooseConnection = mongoose.createConnection(connectionString, {
    dbName: database,
    ...options,
  });
  
  // Wait for connection to be ready with timeout
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new ConnectionError("Mongoose connection timeout", { cacheKey }));
    }, 10000); // 10 second timeout

    const cleanup = () => {
      clearTimeout(timeout);
      mongooseConnection.removeListener("connected", onConnected);
      mongooseConnection.removeListener("error", onError);
    };

    const onConnected = () => {
      cleanup();
      resolve();
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    mongooseConnection.once("connected", onConnected);
    mongooseConnection.once("error", onError);
    
    // If already connected, resolve immediately
    if (mongooseConnection.readyState === 1) {
      cleanup();
      resolve();
    }
  });
  
  // Cache the connection
  mongooseConnections.set(cacheKey, mongooseConnection);
  
  logger.info(`Created Mongoose connection for ${cacheKey}`, {
    dbType,
    database,
  });
  
  return mongooseConnection;
}

/**
 * Close Mongoose connection for a specific tenant
 */
export async function closeMongooseConnection(
  tenant?: { appid: string; orgid: string; appdbname: string }
): Promise<void> {
  if (!tenant) {
    const { tenant: currentTenant } = await getTenantConnection();
    tenant = currentTenant;
  }
  
  const cacheKey = `${tenant.appid}-${tenant.orgid}-${tenant.appdbname}`;
  const connection = mongooseConnections.get(cacheKey);
  
  if (connection) {
    await connection.close();
    mongooseConnections.delete(cacheKey);
    logger.debug(`Closed Mongoose connection for ${cacheKey}`);
  }
}

/**
 * Close all Mongoose connections
 */
export async function closeAllMongooseConnections(): Promise<void> {
  const closePromises = Array.from(mongooseConnections.values()).map((conn) =>
    conn.close().catch((error: Error) => {
      logger.warn(`Error closing Mongoose connection: ${error.message}`);
    })
  );
  
  await Promise.all(closePromises);
  mongooseConnections.clear();
  logger.info("All Mongoose connections closed");
}

