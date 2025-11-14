import mysql, { Pool } from "mysql2/promise";
import logger from "../utils/loggers";
import { envConfig } from "../config/envConfig";

export async function createMySQLConnection(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string; // This is the parent db, schema is the tenant db
  schema: string;
}): Promise<Pool> {
  try {
    // Create a connection pool with mysql2.
    // The `database` should be the tenant-specific schema.
    const pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.schema, // Connect directly to the tenant's schema
      waitForConnections: true,
      connectionLimit: envConfig.MYSQL_POOL_MAX,
      queueLimit: envConfig.MYSQL_QUEUE_LIMIT,
    });

    // Test the connection by getting one from the pool
    const connection = await pool.getConnection();
    connection.release();

    logger.info(`Connected to MySQL and created pool for database: ${config.schema}`, {
      host: config.host,
      schema: config.schema,
      connectionLimit: envConfig.MYSQL_POOL_MAX,
    });
    return pool;
  } catch (error) {
    logger.error(`Error connecting to MySQL: ${(error as Error).message}`, {
      host: config.host,
      schema: config.schema,
    });
    throw error;
  }
}
