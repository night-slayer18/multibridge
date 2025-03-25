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
  });
  try {
    // Set search_path to the desired schema
    await pool.query(`SET search_path TO ${config.schema}`);
    logger.info("Connected to PostgreSQL");
    return pool;
  } catch (error) {
    logger.error(`Error connecting to PostgreSQL: ${(error as Error).message}`);
    throw error;
  }
}