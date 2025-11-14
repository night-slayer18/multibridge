import { Client, types } from "cassandra-driver";
import logger from "../utils/loggers";
import { QueryError } from "../utils/errors";
import { envConfig } from "../config/envConfig";

export async function executeCassandraQuery(
  connection: Client,
  query: string,
  params?: any[]
): Promise<types.ResultSet> {
  try {
    const timeout = envConfig.CASSANDRA_QUERY_TIMEOUT_MS;
    const executeOptions: any = { prepare: true };
    
    if (timeout > 0) {
      executeOptions.readTimeout = timeout;
    }
    
    return await connection.execute(query, params, executeOptions);
  } catch (error) {
    logger.error(`Error executing Cassandra query: ${(error as Error).message}`, {
      query: query.substring(0, 100), // Log first 100 chars of query
      error: (error as Error).stack,
    });
    throw new QueryError(`Cassandra query execution failed: ${(error as Error).message}`, {
      query: query.substring(0, 100),
      originalError: error,
    });
  }
}
