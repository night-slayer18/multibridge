import cassandra from "cassandra-driver";

export async function getCassandraConnection({ host, port, username, password, database }: any) {
  const authProvider = new cassandra.auth.PlainTextAuthProvider(username, password);
  const client = new cassandra.Client({
    contactPoints: [host],
    localDataCenter: "datacenter1",
    keyspace: database,
    authProvider,
  });

  await client.connect();
  return client;
}