export async function executeCassandraQuery(connection: any, query: string, params?: any[]): Promise<any> {
    return connection.execute(query, params, { prepare: true });
  }
  