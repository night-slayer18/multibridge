import { Pool } from "pg";
import logger from "../utils/loggers";

export async function createPostgresConnection(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema: string;
}): Promise<Pool> {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    idleTimeoutMillis: 600000,      // e.g., 10 minutes, adjust as needed
    connectionTimeoutMillis: 5000,  // e.g., 5 seconds
  });

  // For every new connection, set the search_path
  pool.on("connect", async (client) => {
    try {
      await client.query(`SET search_path TO ${config.schema}`);
      logger.info(`Search path set to ${config.schema} for new connection`);
    } catch (error) {
      logger.error(`Failed to set search path on new connection: ${(error as Error).message}`);
    }
  });

  // Test the pool by acquiring a client once
  try {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${config.schema}`);
      logger.info("Connected to PostgreSQL and search_path set");
    } finally {
      client.release();
    }
    return pool;
  } catch (error) {
    logger.error(`Error establishing initial connection to PostgreSQL: ${(error as Error).message}`);
    throw error;
  }
}
