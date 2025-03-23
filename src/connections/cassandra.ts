import cassandra from "cassandra-driver";

export async function createCassandraConnection(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;  // For Cassandra, this is the keyspace.
  dataCenter?: string;
}): Promise<any> {
  const client = new cassandra.Client({
    contactPoints: [config.host],
    localDataCenter: config.dataCenter || "datacenter1",
    keyspace: config.database,
    credentials: { username: config.username, password: config.password },
  });
  await client.connect();
  return client;
}
