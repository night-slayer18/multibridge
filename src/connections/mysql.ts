import mysql from "mysql2/promise";

export async function getMySQLConnection({ host, port, username, password, database, schema }: any) {
  const connection = await mysql.createConnection({
    host,
    port,
    user: username,
    password,
    database,
  });

  await connection.query(`USE ${schema}`);
  return connection;
}
