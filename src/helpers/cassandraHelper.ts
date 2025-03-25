import { Client, types } from "cassandra-driver";
import logger from "../utils/loggers";

export async function executeCassandraQuery(
  connection: Client,
  query: string,
  params?: any[]
): Promise<types.ResultSet> {
  try {
    return await connection.execute(query, params, { prepare: true });
  } catch (error) {
    logger.error(`Error executing Cassandra query: ${(error as Error).message}`);
    throw error;
  }
}
