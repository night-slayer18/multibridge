import { getConnection } from "../connections/connectionManager";
import { executeMongoQuery } from "../helpers/mongodbHelper";
import { executeCassandraQuery } from "../helpers/cassandraHelper";
import logger from "./loggers";
import { Pool as PgPool } from "pg";
import { Pool as MySqlPool } from "mysql2/promise";
import { MongoConnection } from "../connections/mongodb";
import { Client as CassandraClient } from "cassandra-driver";
import { envConfig } from "../config/envConfig";
import { getTenant } from "../context/tenantContext";
import { QueryError, TimeoutError } from "./errors";

// Query type definitions for better type safety
export interface SQLQuery {
  type: "sql";
  query: string;
  params?: any[];
}

export interface MongoQuery {
  type: "mongodb";
  collection: string;
  method: string;
  args?: any[];
}

export interface CassandraQuery {
  type: "cassandra";
  query: string;
  params?: any[];
}

export type Query = string | SQLQuery | MongoQuery | CassandraQuery | { collection: string; method: string; args?: any[] };

/**
 * Execute query with timeout
 */
async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  queryInfo: string
): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }

  let timeoutId: NodeJS.Timeout | null = null;
  
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`Query timeout after ${timeoutMs}ms: ${queryInfo}`, {
        timeoutMs,
        queryInfo,
      }));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    // Clear timeout if promise resolved first
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    return result;
  } catch (error) {
    // Clear timeout on error
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    throw error;
  }
}

/**
 * Executes a query using the connection determined by the tenant context.
 * For PostgreSQL and MySQL, the native connection.query is used.
 * For MongoDB and Cassandra, corresponding helper functions are invoked.
 */
export async function executeQuery(query: Query, params?: any[]): Promise<any> {
  const tenant = getTenant();
  const tenantContext = tenant ? { appid: tenant.appid, orgid: tenant.orgid } : {};

  try {
    const { connection, dbType } = await getConnection();

    switch (dbType) {
      case "postgres": {
        const timeout = envConfig.POSTGRES_QUERY_TIMEOUT_MS;
        let queryString: string;
        let queryParams: any[] | undefined;

        if (typeof query === "string") {
          queryString = query;
          queryParams = params;
        } else if (typeof query === "object" && "query" in query && typeof (query as SQLQuery).query === "string") {
          queryString = (query as SQLQuery).query;
          queryParams = params || (query as SQLQuery).params;
        } else {
          throw new QueryError("PostgreSQL query must be a string or SQLQuery object", {
            ...tenantContext,
            query,
          });
        }

        const queryPromise = (connection as PgPool).query(queryString, queryParams || []);
        const result = await executeWithTimeout(
          queryPromise,
          timeout,
          `PostgreSQL query: ${queryString.substring(0, 100)}`
        );

        logger.debug("PostgreSQL query executed", {
          ...tenantContext,
          queryLength: queryString.length,
        });

        return result;
      }

      case "mysql": {
        const timeout = envConfig.MYSQL_QUERY_TIMEOUT_MS;
        let queryString: string;
        let queryParams: any[] | undefined;

        if (typeof query === "string") {
          queryString = query;
          queryParams = params;
        } else if (typeof query === "object" && "query" in query && typeof (query as SQLQuery).query === "string") {
          queryString = (query as SQLQuery).query;
          queryParams = params || (query as SQLQuery).params;
        } else {
          throw new QueryError("MySQL query must be a string or SQLQuery object", {
            ...tenantContext,
            query,
          });
        }

        const queryPromise = (connection as MySqlPool).query(queryString, queryParams);
        const result = await executeWithTimeout(
          queryPromise,
          timeout,
          `MySQL query: ${queryString.substring(0, 100)}`
        );

        logger.debug("MySQL query executed", {
          ...tenantContext,
          queryLength: queryString.length,
        });

        return result;
      }

      case "mongodb": {
        const timeout = envConfig.MONGODB_QUERY_TIMEOUT_MS;
        let mongoQuery: { collection: string; method: string; args?: any[] };

        if (typeof query === "object" && "collection" in query && "method" in query) {
          mongoQuery = query as MongoQuery;
        } else {
          throw new QueryError("MongoDB query must be an object with 'collection' and 'method' properties", {
            ...tenantContext,
            query,
          });
        }

        const queryPromise = executeMongoQuery((connection as MongoConnection).db, mongoQuery);
        const result = await executeWithTimeout(
          queryPromise,
          timeout,
          `MongoDB ${mongoQuery.collection}.${mongoQuery.method}()`
        );

        logger.debug("MongoDB query executed", {
          ...tenantContext,
          collection: mongoQuery.collection,
          method: mongoQuery.method,
        });

        return result;
      }

      case "cassandra": {
        const timeout = envConfig.CASSANDRA_QUERY_TIMEOUT_MS;
        let queryString: string;
        let queryParams: any[] | undefined;

        if (typeof query === "string") {
          queryString = query;
          queryParams = params;
        } else if (typeof query === "object" && "query" in query && typeof (query as CassandraQuery).query === "string") {
          queryString = (query as CassandraQuery).query;
          queryParams = params || (query as CassandraQuery).params;
        } else {
          throw new QueryError("Cassandra query must be a string or CassandraQuery object", {
            ...tenantContext,
            query,
          });
        }

        const queryPromise = executeCassandraQuery(connection as CassandraClient, queryString, queryParams);
        const result = await executeWithTimeout(
          queryPromise,
          timeout,
          `Cassandra query: ${queryString.substring(0, 100)}`
        );

        logger.debug("Cassandra query executed", {
          ...tenantContext,
          queryLength: queryString.length,
        });

        return result;
      }

      default:
        throw new QueryError(`Unsupported database type: ${dbType}`, {
          ...tenantContext,
          dbType,
        });
    }
  } catch (error) {
    const queryInfo = typeof query === "string" 
      ? query.substring(0, 100) 
      : typeof query === "object" && "collection" in query
      ? `${query.collection}.${query.method}()`
      : "unknown query";

    // Try to get dbType, but don't fail if getConnection fails
    let dbType: string = "unknown";
    try {
      const connectionData = await getConnection();
      dbType = connectionData.dbType;
    } catch {
      // Ignore - we're already in error handling
    }

    logger.error(`Error executing query: ${(error as Error).message}`, {
      ...tenantContext,
      dbType,
      query: queryInfo,
      error: (error as Error).stack,
    });

    // Re-throw with context
    if (error instanceof QueryError || error instanceof TimeoutError) {
      throw error;
    }

    throw new QueryError(`Query execution failed: ${(error as Error).message}`, {
      ...tenantContext,
      query: queryInfo,
      originalError: error,
    });
  }
}
