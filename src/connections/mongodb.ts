import { MongoClient } from "mongodb";

export async function getMongoDBConnection({ host, port, username, password, database }: any) {
  const uri = `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=admin`;
  const client = new MongoClient(uri);

  await client.connect();
  return client.db(database);
}
