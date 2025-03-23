import mysql from "mysql2/promise";

export async function createMySQLConnection(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema: string;
}): Promise<any> {
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
  return connection;
}
