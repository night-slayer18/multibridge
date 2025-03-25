import { getConnection } from "../connections/connectionManager";
import { executeMongoQuery } from "../helpers/mongodbHelper";
import { executeCassandraQuery } from "../helpers/cassandraHelper";
import logger from "./loggers";

/**
 * Executes a query using the connection determined by the tenant context.
 * For PostgreSQL and MySQL, the native connection.query is used.
 * For MongoDB and Cassandra, corresponding helper functions are invoked.
 */
export async function executeQuery(query: string | any, params?: any[]): Promise<any> {
  try {
    // getConnection now returns an object with { connection, dbType }
    const { connection, dbType } = await getConnection();
    
    switch (dbType) {
      case "postgres":
      case "mysql":
        // For these, query is a string and params is an array
        return connection.query(query, params);
      case "mongodb":
        // For MongoDB, expect query to be an object with collection, method, args.
        return executeMongoQuery(connection, query);
      case "cassandra":
        return executeCassandraQuery(connection, query, params);
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  } catch (error) {
    logger.error(`Error executing query: ${(error as Error).message}`);
    throw error;
    
  }
}
