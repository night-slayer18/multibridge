import { Db, MongoClient } from "mongodb";
import logger from "../utils/loggers";

export async function createMongoDBConnection(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}): Promise<Db> {
  // Construct the MongoDB URI; MongoDB doesn't use schemas as SQL does.
  const uri = `mongodb://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}?authSource=admin`;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    // Return the database object (this is analogous to a connection)
    logger.info("Connected to MongoDB");
    return client.db(config.database);
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${(error as Error).message}`);
    throw error;
  }
}
