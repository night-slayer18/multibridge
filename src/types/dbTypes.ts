import { Pool as PgPool } from "pg";
import { Pool as MySqlPool } from "mysql2/promise";
import { Client as CassandraClient } from "cassandra-driver";
import { MongoConnection } from "../connections/mongodb";

export type DBType = "postgres" | "mysql" | "mongodb" | "cassandra";

// A union type representing any possible database connection object
export type AnyConnection = PgPool | MySqlPool | MongoConnection | CassandraClient;

// Re-export concrete connection types for consumers to import from a single place
export type { PgPool, MySqlPool, MongoConnection, CassandraClient };

export interface CentralDBConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  db_type: DBType;
  schema?: string;
  data_center?: string;
}

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