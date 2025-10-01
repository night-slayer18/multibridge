import { getConnection } from "../connections/connectionManager";
import { executeMongoQuery } from "../helpers/mongodbHelper";
import { executeCassandraQuery } from "../helpers/cassandraHelper";
import logger from "./loggers";
import { Pool as PgPool } from "pg";
import { Pool as MySqlPool } from "mysql2/promise";
import { MongoConnection } from "../connections/mongodb";
import { Client as CassandraClient } from "cassandra-driver";

/**
 * Executes a query using the connection determined by the tenant context.
 * For PostgreSQL and MySQL, the native connection.query is used.
 * For MongoDB and Cassandra, corresponding helper functions are invoked.
 */
export async function executeQuery(query: string | any, params?: any[]): Promise<any> {
  try {
    const { connection, dbType } = await getConnection();

    switch (dbType) {
      case "postgres":
        // Type assertion for pg.Pool
        return (connection as PgPool).query(query, params);
      case "mysql":
        // Type assertion for mysql2.Pool
        return (connection as MySqlPool).query(query, params);
      case "mongodb":
        // For MongoDB, query is an object, and we use a helper. Pass the `db` instance.
        return executeMongoQuery((connection as MongoConnection).db, query);
      case "cassandra":
        // For Cassandra, query is a string, and we use a helper
        return executeCassandraQuery(connection as CassandraClient, query, params);
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  } catch (error) {
    logger.error(`Error executing query: ${(error as Error).message}`);
    throw error;
  }
}
