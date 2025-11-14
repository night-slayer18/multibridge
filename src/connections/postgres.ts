import { Pool } from "pg";
import logger from "../utils/loggers";
import { envConfig } from "../config/envConfig";
import { ValidationError } from "../utils/errors";

/**
 * Sanitize and validate schema name to prevent SQL injection
 * Uses PostgreSQL identifier quoting
 */
function sanitizeSchemaName(schema: string): string {
  // Validate schema name contains only safe characters
  if (!/^[a-zA-Z0-9_]+$/.test(schema)) {
    throw new ValidationError(`Invalid schema name: ${schema}. Only alphanumeric and underscore are allowed.`);
  }
  
  // Use PostgreSQL identifier quoting to safely escape
  // Replace any double quotes with escaped quotes and wrap in quotes
  const escaped = schema.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function createPostgresConnection(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema: string;
}): Promise<Pool> {
  const sanitizedSchema = sanitizeSchemaName(config.schema);
  
  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    max: envConfig.POSTGRES_POOL_MAX,
    min: envConfig.POSTGRES_POOL_MIN,
    idleTimeoutMillis: 600000,      // 10 minutes
    connectionTimeoutMillis: 5000,    // 5 seconds
  });

  // For every new connection, set the search_path
  pool.on("connect", async (client) => {
    try {
      // Use sanitized schema name with proper quoting
      await client.query(`SET search_path TO ${sanitizedSchema}`);
      logger.debug(`Search path set to ${config.schema} for new connection`);
    } catch (error) {
      logger.error(`Failed to set search path on new connection: ${(error as Error).message}`, {
        schema: config.schema,
      });
    }
  });

  // Add pool event listeners for monitoring
  pool.on("error", (err) => {
    logger.error(`Unexpected error on idle PostgreSQL client: ${err.message}`, {
      host: config.host,
      database: config.database,
    });
  });

  // Test the pool by acquiring a client once
  try {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${sanitizedSchema}`);
      logger.info("Connected to PostgreSQL and search_path set", {
        schema: config.schema,
        host: config.host,
        database: config.database,
      });
    } finally {
      client.release();
    }
    return pool;
  } catch (error) {
    logger.error(`Error establishing initial connection to PostgreSQL: ${(error as Error).message}`, {
      host: config.host,
      database: config.database,
      schema: config.schema,
    });
    throw error;
  }
}
