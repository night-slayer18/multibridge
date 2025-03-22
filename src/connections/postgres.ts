import { Pool } from "pg";

export async function getPostgresConnection({ host, port, username, password, database, schema }: any) {
  const pool = new Pool({
    host,
    port,
    user: username,
    password,
    database,
  });

  await pool.query(`SET search_path TO ${schema}`);
  return pool;
}
