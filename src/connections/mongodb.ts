import { MongoClient } from "mongodb";

export async function createMongoDBConnection(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}): Promise<any> {
  // Construct the MongoDB URI; MongoDB doesn't use schemas as SQL does.
  const uri = `mongodb://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}?authSource=admin`;
  const client = new MongoClient(uri);
  await client.connect();
  // Return the database object (this is analogous to a connection)
  return client.db(config.database);
}
