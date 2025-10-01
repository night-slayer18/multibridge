import { Db, MongoClient } from "mongodb";
import logger from "../utils/loggers";

export interface MongoConnection {
  client: MongoClient;
  db: Db;
}

export async function createMongoDBConnection(config: {
  host: string;
  port?: number;
  username: string;
  password: string;
  database: string;
}): Promise<MongoConnection> {
  let uri: string;

  if (config.host.endsWith(".mongodb.net")) {
    // MongoDB Atlas (Cluster) using SRV
    uri = `mongodb+srv://${config.username}:${config.password}@${config.host}/${config.database}?authSource=admin`;
  } else {
    // Self-hosted MongoDB (Local/Remote)
    uri = `mongodb://${config.username}:${config.password}@${config.host}:${config.port ?? 27017}/${config.database}?authSource=admin`;
  }

  const client = new MongoClient(uri, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await client.connect();
    logger.info(`Connected to MongoDB at ${config.host}`);
    return { client, db: client.db(config.database) };
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${(error as Error).message}`);
    throw error;
  }
}