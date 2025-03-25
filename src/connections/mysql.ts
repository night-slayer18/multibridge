import mysql, { Connection } from "mysql2/promise";
import logger from "../utils/loggers";

export async function createMySQLConnection(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema: string;
}): Promise<Connection> {
  try {
    // Create a connection (or pool) with mysql2
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    // Use the specified schema (database) - in MySQL, typically "USE schema"
    await connection.query(`USE ${config.schema}`);
    logger.info("Connected to MySQL");
    return connection;
  } catch (error) {
    logger.error(`Error connecting to MySQL: ${(error as Error).message}`);
    throw error;
  }
}
