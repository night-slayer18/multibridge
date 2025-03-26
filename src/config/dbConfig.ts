import { Pool } from "pg";
import { envConfig } from "./envConfig";
import logger from "../utils/loggers";

const centralDB = new Pool({
  host: envConfig.CENTRAL_DB_HOST,
  port: envConfig.CENTRAL_DB_PORT,
  user: envConfig.CENTRAL_DB_USER,
  password: envConfig.CENTRAL_DB_PASSWORD,
  database: envConfig.CENTRAL_DB_NAME,
});

export async function fetchDBConfig(appId: string, orgId: string) {
  try {
    const tableName = envConfig.CENTRAL_DB_TABLE;
    if (!tableName) {
      throw new Error("CENTRAL_DB_TABLE is not set in the environment");
    }
    const query = `SELECT * FROM ${tableName} WHERE app_id = $1 AND org_id = $2`;
    const result = await centralDB.query(query, [appId, orgId]);
    if (result.rows.length === 0) {
      logger.error(`No connection config found for app ${appId} and org ${orgId} in the DB`);
      return null;
    }
    logger.info(`Fetched configuration for appid: ${appId}, orgid: ${orgId}`);
    return result.rows[0];
  } catch (error) {
    logger.error(`Error fetching DB config: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
    throw error;
  }
}