import { Pool } from "pg";

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
  // Set search_path to the desired schema
  await pool.query(`SET search_path TO ${config.schema}`);
  return pool;
}