/**
 * Cassandra ORM adapter for MultiBridge
 * Provides an ORM-like interface using cassandra-driver
 * Supports: Cassandra
 */

import { Client, types } from "cassandra-driver";
import { getTenantConnection, validateORMSupport } from "./base";
import { DBType } from "../types/dbTypes";
import { Client as CassandraClient } from "cassandra-driver";
import logger from "../utils/loggers";
import { ConnectionError, QueryError, ValidationError } from "../utils/errors";

/**
 * Sanitize and validate Cassandra identifier (keyspace, table, column names)
 * CQL identifiers can contain alphanumeric, underscore, and must not be a reserved word
 */
function sanitizeCQLIdentifier(identifier: string, type: "keyspace" | "table" | "column"): string {
  // Validate identifier contains only safe characters
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new ValidationError(
      `Invalid ${type} name: ${identifier}. Only alphanumeric and underscore are allowed.`
    );
  }
  
  // Check for reserved words (basic check)
  const reservedWords = new Set([
    "key", "keyspace", "table", "column", "select", "insert", "update", "delete",
    "create", "alter", "drop", "use", "from", "where", "and", "or", "not",
  ]);
  
  if (reservedWords.has(identifier.toLowerCase())) {
    throw new ValidationError(
      `Invalid ${type} name: ${identifier}. Cannot use reserved CQL keywords.`
    );
  }
  
  // Use double quotes for case sensitivity and to escape if needed
  // Replace any double quotes with escaped quotes
  const escaped = identifier.replace(/"/g, '""');
  return `"${escaped}"`;
}

// Cache for Cassandra clients per tenant
const cassandraClients = new Map<string, Client>();

/**
 * Model definition interface for Cassandra
 */
export interface CassandraModelDefinition {
  tableName: string;
  keyspace?: string; // Optional, defaults to tenant's keyspace
  partitionKeys: string[]; // Partition key columns
  clusteringKeys?: string[]; // Clustering key columns (optional)
  columns: Record<string, string>; // Column name -> CQL type mapping
  indexes?: string[]; // Index names (optional)
}

/**
 * Get or create a Cassandra client for the current tenant
 * 
 * @returns Cassandra Client instance configured for the current tenant
 * 
 * @example
 * ```typescript
 * await runWithTenant(tenant, async () => {
 *   const client = await getCassandraClient();
 *   const result = await client.execute("SELECT * FROM users WHERE id = ?", [userId]);
 * });
 * ```
 */
export async function getCassandraClient(): Promise<Client> {
  const { tenant, connectionData, dbType } = await getTenantConnection();
  
  // Validate database type
  validateORMSupport(dbType, ["cassandra"]);
  
  const cacheKey = `${tenant.appid}-${tenant.orgid}-${tenant.appdbname}`;
  
  // Check cache
  const cached = cassandraClients.get(cacheKey);
  if (cached) {
    logger.debug(`Reusing cached Cassandra client for ${cacheKey}`);
    return cached;
  }
  
  // Get Cassandra client from MultiBridge connection
  const client = connectionData.connection as CassandraClient;
  
  // Cache the client
  cassandraClients.set(cacheKey, client);
  
  logger.info(`Created Cassandra client for ${cacheKey}`, {
    dbType,
    keyspace: tenant.appdbname,
  });
  
  return client;
}

/**
 * Execute a CQL query with prepared statement
 * 
 * @param query - CQL query string
 * @param params - Query parameters
 * @param options - Execution options
 * @returns Query result
 */
export async function executeCQL(
  query: string,
  params?: any[],
  options?: { consistency?: types.consistencies; prepare?: boolean }
): Promise<types.ResultSet> {
  const client = await getCassandraClient();
  
  const executeOptions: any = {
    prepare: options?.prepare !== false, // Default to prepared statements
    consistency: options?.consistency || types.consistencies.localQuorum,
  };
  
  try {
    return await client.execute(query, params || [], executeOptions);
  } catch (error) {
    logger.error(`Error executing CQL query: ${(error as Error).message}`, {
      query: query.substring(0, 100),
      error: (error as Error).stack,
    });
    throw new QueryError(`Cassandra query execution failed: ${(error as Error).message}`, {
      query: query.substring(0, 100),
      originalError: error,
    });
  }
}

/**
 * Create a table based on model definition
 * 
 * @param model - Model definition
 * @param ifNotExists - Add IF NOT EXISTS clause
 */
export async function createTable(
  model: CassandraModelDefinition,
  ifNotExists: boolean = true
): Promise<void> {
  const client = await getCassandraClient();
  const { tenant } = await getTenantConnection();
  
  // Sanitize identifiers
  const keyspace = sanitizeCQLIdentifier(model.keyspace || tenant.appdbname, "keyspace");
  const tableName = sanitizeCQLIdentifier(model.tableName, "table");
  
  // Validate and sanitize partition keys
  const sanitizedPartitionKeys = model.partitionKeys.map((key) =>
    sanitizeCQLIdentifier(key, "column")
  );
  
  // Build partition key clause
  const partitionKeyClause = `PRIMARY KEY (${sanitizedPartitionKeys.join(", ")})`;
  
  // Build clustering key clause if present
  let primaryKeyClause = partitionKeyClause;
  if (model.clusteringKeys && model.clusteringKeys.length > 0) {
    const sanitizedClusteringKeys = model.clusteringKeys.map((key) =>
      sanitizeCQLIdentifier(key, "column")
    );
    primaryKeyClause = `PRIMARY KEY ((${sanitizedPartitionKeys.join(", ")}), ${sanitizedClusteringKeys.join(", ")})`;
  }
  
  // Build column definitions with sanitized names
  const columnDefs = Object.entries(model.columns)
    .map(([name, type]) => {
      const sanitizedName = sanitizeCQLIdentifier(name, "column");
      // Validate type is a safe CQL type
      if (!/^[a-zA-Z0-9_<>\[\]()]+$/.test(type)) {
        throw new ValidationError(`Invalid CQL type: ${type}`);
      }
      return `${sanitizedName} ${type}`;
    })
    .join(", ");
  
  const ifNotExistsClause = ifNotExists ? "IF NOT EXISTS" : "";
  const query = `
    CREATE TABLE ${ifNotExistsClause} ${keyspace}.${tableName} (
      ${columnDefs},
      ${primaryKeyClause}
    )
  `.trim();
  
  try {
    await client.execute(query, [], { prepare: false });
    logger.info(`Created table ${keyspace}.${tableName}`);
  } catch (error) {
    logger.error(`Error creating table: ${(error as Error).message}`, {
      table: model.tableName,
      keyspace: model.keyspace || tenant.appdbname,
      error: (error as Error).stack,
    });
    throw error;
  }
}

/**
 * Insert a row into a table
 * 
 * @param tableName - Table name
 * @param data - Data to insert (column -> value mapping)
 * @param keyspace - Optional keyspace (defaults to tenant's keyspace)
 * @param ttl - Optional TTL in seconds
 */
export async function insert(
  tableName: string,
  data: Record<string, any>,
  keyspace?: string,
  ttl?: number
): Promise<types.ResultSet> {
  const { tenant } = await getTenantConnection();
  const targetKeyspace = keyspace || tenant.appdbname;
  
  // Sanitize identifiers
  const sanitizedKeyspace = sanitizeCQLIdentifier(targetKeyspace, "keyspace");
  const sanitizedTable = sanitizeCQLIdentifier(tableName, "table");
  const sanitizedColumns = Object.keys(data).map((col) => sanitizeCQLIdentifier(col, "column"));
  
  const values = Object.values(data);
  const placeholders = sanitizedColumns.map(() => "?").join(", ");
  
  let query = `INSERT INTO ${sanitizedKeyspace}.${sanitizedTable} (${sanitizedColumns.join(", ")}) VALUES (${placeholders})`;
  if (ttl && ttl > 0) {
    query += ` USING TTL ${ttl}`;
  }
  
  return await executeCQL(query, values);
}

/**
 * Select rows from a table
 * 
 * @param tableName - Table name
 * @param whereClause - WHERE clause (e.g., "id = ? AND name = ?")
 * @param params - Parameters for WHERE clause
 * @param keyspace - Optional keyspace (defaults to tenant's keyspace)
 * @param limit - Optional LIMIT clause
 * @param allowFiltering - Enable ALLOW FILTERING (use with caution)
 */
export async function select(
  tableName: string,
  whereClause?: string,
  params?: any[],
  keyspace?: string,
  limit?: number,
  allowFiltering: boolean = false
): Promise<types.ResultSet> {
  const { tenant } = await getTenantConnection();
  const targetKeyspace = keyspace || tenant.appdbname;
  
  // Sanitize identifiers
  const sanitizedKeyspace = sanitizeCQLIdentifier(targetKeyspace, "keyspace");
  const sanitizedTable = sanitizeCQLIdentifier(tableName, "table");
  
  let query = `SELECT * FROM ${sanitizedKeyspace}.${sanitizedTable}`;
  // Note: whereClause should be provided by the caller and use parameterized queries
  // We validate it doesn't contain dangerous patterns
  if (whereClause) {
    // Basic validation - whereClause should only contain column names and operators
    if (/[;'"]/.test(whereClause)) {
      throw new ValidationError("WHERE clause contains potentially dangerous characters. Use parameterized queries.");
    }
    query += ` WHERE ${whereClause}`;
  }
  if (limit && limit > 0) {
    query += ` LIMIT ${limit}`;
  }
  if (allowFiltering) {
    query += ` ALLOW FILTERING`;
  }
  
  return await executeCQL(query, params);
}

/**
 * Update rows in a table
 * 
 * @param tableName - Table name
 * @param data - Data to update (column -> value mapping)
 * @param whereClause - WHERE clause (e.g., "id = ?")
 * @param whereParams - Parameters for WHERE clause
 * @param keyspace - Optional keyspace (defaults to tenant's keyspace)
 * @param ttl - Optional TTL in seconds
 */
export async function update(
  tableName: string,
  data: Record<string, any>,
  whereClause: string,
  whereParams: any[],
  keyspace?: string,
  ttl?: number
): Promise<types.ResultSet> {
  const { tenant } = await getTenantConnection();
  const targetKeyspace = keyspace || tenant.appdbname;
  
  // Sanitize identifiers
  const sanitizedKeyspace = sanitizeCQLIdentifier(targetKeyspace, "keyspace");
  const sanitizedTable = sanitizeCQLIdentifier(tableName, "table");
  const sanitizedColumns = Object.keys(data).map((col) => sanitizeCQLIdentifier(col, "column"));
  
  const setClause = sanitizedColumns.map((col) => `${col} = ?`).join(", ");
  const values = [...Object.values(data), ...whereParams];
  
  // Validate whereClause
  if (/[;'"]/.test(whereClause)) {
    throw new ValidationError("WHERE clause contains potentially dangerous characters. Use parameterized queries.");
  }
  
  let query = `UPDATE ${sanitizedKeyspace}.${sanitizedTable} SET ${setClause} WHERE ${whereClause}`;
  if (ttl && ttl > 0) {
    query += ` USING TTL ${ttl}`;
  }
  
  return await executeCQL(query, values);
}

/**
 * Delete rows from a table
 * 
 * @param tableName - Table name
 * @param whereClause - WHERE clause (e.g., "id = ?")
 * @param params - Parameters for WHERE clause
 * @param keyspace - Optional keyspace (defaults to tenant's keyspace)
 */
export async function remove(
  tableName: string,
  whereClause: string,
  params: any[],
  keyspace?: string
): Promise<types.ResultSet> {
  const { tenant } = await getTenantConnection();
  const targetKeyspace = keyspace || tenant.appdbname;
  
  // Sanitize identifiers
  const sanitizedKeyspace = sanitizeCQLIdentifier(targetKeyspace, "keyspace");
  const sanitizedTable = sanitizeCQLIdentifier(tableName, "table");
  
  // Validate whereClause
  if (/[;'"]/.test(whereClause)) {
    throw new ValidationError("WHERE clause contains potentially dangerous characters. Use parameterized queries.");
  }
  
  const query = `DELETE FROM ${sanitizedKeyspace}.${sanitizedTable} WHERE ${whereClause}`;
  return await executeCQL(query, params);
}

/**
 * Close Cassandra client for a specific tenant
 */
export async function closeCassandraClient(
  tenant?: { appid: string; orgid: string; appdbname: string }
): Promise<void> {
  if (!tenant) {
    const { tenant: currentTenant } = await getTenantConnection();
    tenant = currentTenant;
  }
  
  const cacheKey = `${tenant.appid}-${tenant.orgid}-${tenant.appdbname}`;
  const client = cassandraClients.get(cacheKey);
  
  if (client) {
    await client.shutdown();
    cassandraClients.delete(cacheKey);
    logger.debug(`Closed Cassandra client for ${cacheKey}`);
  }
}

/**
 * Close all Cassandra clients
 */
export async function closeAllCassandraClients(): Promise<void> {
  const closePromises = Array.from(cassandraClients.values()).map((client) =>
    client.shutdown().catch((error) => {
      logger.warn(`Error closing Cassandra client: ${(error as Error).message}`);
    })
  );
  
  await Promise.all(closePromises);
  cassandraClients.clear();
  logger.info("All Cassandra clients closed");
}

