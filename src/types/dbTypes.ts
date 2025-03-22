export type DBType = "postgres" | "mysql" | "mongodb" | "cassandra";

export interface DBConfig {
  type: DBType;
  host: string;
  database: string;
  user: string;
  password: string;
  port: number;
  uri?: string; // For MongoDB
  dataCenter?: string; // For Cassandra
}

export interface ConnectionInstances {
  [key: string]: any;
}