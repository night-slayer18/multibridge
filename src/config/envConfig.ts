import dotenv from "dotenv";
import path from "path";

// Directly specify the path to your .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const requiredEnvVars = [
  "CENTRAL_DB_HOST",
  "CENTRAL_DB_PORT",
  "CENTRAL_DB_USER",
  "CENTRAL_DB_PASSWORD",
  "CENTRAL_DB_NAME",
  "CENTRAL_DB_TABLE",
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Environment variable ${envVar} is required but not set.`);
  }
});

const port = parseInt(process.env.CENTRAL_DB_PORT as string, 10);
if (isNaN(port)) {
  throw new Error("Environment variable CENTRAL_DB_PORT must be a valid number.");
}

// Parse optional numeric configs with defaults
const parseIntWithDefault = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const envConfig = {
  CENTRAL_DB_HOST: process.env.CENTRAL_DB_HOST as string,
  CENTRAL_DB_PORT: port,
  CENTRAL_DB_USER: process.env.CENTRAL_DB_USER as string,
  CENTRAL_DB_PASSWORD: process.env.CENTRAL_DB_PASSWORD as string,
  CENTRAL_DB_NAME: process.env.CENTRAL_DB_NAME as string,
  CENTRAL_DB_TABLE: process.env.CENTRAL_DB_TABLE as string,
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  
  // Connection cache settings
  CONNECTION_CACHE_MAX_SIZE: parseIntWithDefault(process.env.CONNECTION_CACHE_MAX_SIZE, 100),
  CONNECTION_CACHE_TTL_MS: parseIntWithDefault(process.env.CONNECTION_CACHE_TTL_MS, 0), // 0 = no TTL
  
  // Config cache settings
  CONFIG_CACHE_TTL_MS: parseIntWithDefault(process.env.CONFIG_CACHE_TTL_MS, 900000), // 15 minutes default
  
  // Connection pool settings
  POSTGRES_POOL_MAX: parseIntWithDefault(process.env.POSTGRES_POOL_MAX, 10),
  POSTGRES_POOL_MIN: parseIntWithDefault(process.env.POSTGRES_POOL_MIN, 2),
  MYSQL_POOL_MAX: parseIntWithDefault(process.env.MYSQL_POOL_MAX, 10),
  MYSQL_QUEUE_LIMIT: parseIntWithDefault(process.env.MYSQL_QUEUE_LIMIT, 0),
  
  // Query timeout settings (in milliseconds)
  QUERY_TIMEOUT_MS: parseIntWithDefault(process.env.QUERY_TIMEOUT_MS, 30000), // 30 seconds default
  POSTGRES_QUERY_TIMEOUT_MS: parseIntWithDefault(process.env.POSTGRES_QUERY_TIMEOUT_MS, 30000),
  MYSQL_QUERY_TIMEOUT_MS: parseIntWithDefault(process.env.MYSQL_QUERY_TIMEOUT_MS, 30000),
  MONGODB_QUERY_TIMEOUT_MS: parseIntWithDefault(process.env.MONGODB_QUERY_TIMEOUT_MS, 30000),
  CASSANDRA_QUERY_TIMEOUT_MS: parseIntWithDefault(process.env.CASSANDRA_QUERY_TIMEOUT_MS, 30000),
  
  // Connection validation settings
  CONNECTION_VALIDATION_TTL_MS: parseIntWithDefault(process.env.CONNECTION_VALIDATION_TTL_MS, 60000), // 1 minute default
  
  // Retry settings
  CONNECTION_RETRY_ATTEMPTS: parseIntWithDefault(process.env.CONNECTION_RETRY_ATTEMPTS, 3),
  CONNECTION_RETRY_DELAY_MS: parseIntWithDefault(process.env.CONNECTION_RETRY_DELAY_MS, 1000),
  
  // Rate limiting settings
  RATE_LIMIT_MAX_REQUESTS: parseIntWithDefault(process.env.RATE_LIMIT_MAX_REQUESTS, 10),
  RATE_LIMIT_WINDOW_MS: parseIntWithDefault(process.env.RATE_LIMIT_WINDOW_MS, 60000), // 1 minute
};
