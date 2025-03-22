import { Pool } from "pg";
import { envConfig } from "./envConfig";

const centralDB = new Pool({
  host: envConfig.CENTRAL_DB_HOST,
  port: envConfig.CENTRAL_DB_PORT,
  user: envConfig.CENTRAL_DB_USER,
  password: envConfig.CENTRAL_DB_PASSWORD,
  database: envConfig.CENTRAL_DB_NAME,
});

export async function fetchDBConfig(appId: string, orgId: string) {
  const query = "SELECT * FROM connection_config WHERE app_id = $1 AND org_id = $2";
  const result = await centralDB.query(query, [appId, orgId]);

  return result.rows.length > 0 ? result.rows[0] : null;
}
