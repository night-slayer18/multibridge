import cassandra from "cassandra-driver";
import logger from "../utils/loggers";

export async function createCassandraConnection(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;  // For Cassandra, this is the keyspace.
  dataCenter?: string;
}): Promise<cassandra.Client> {
  const client = new cassandra.Client({
    contactPoints: [config.host],
    localDataCenter: config.dataCenter || "datacenter1",
    keyspace: config.database,
    credentials: { username: config.username, password: config.password },
  });
  try {
    await client.connect();
    logger.info("Connected to Cassandra");
    return client;
  } catch (error) {
    logger.error(`Error connecting to Cassandra: ${(error as Error).message}`);
    throw error;
  }
}
