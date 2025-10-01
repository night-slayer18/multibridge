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

export const envConfig = {
  CENTRAL_DB_HOST: process.env.CENTRAL_DB_HOST as string,
  CENTRAL_DB_PORT: port,
  CENTRAL_DB_USER: process.env.CENTRAL_DB_USER as string,
  CENTRAL_DB_PASSWORD: process.env.CENTRAL_DB_PASSWORD as string,
  CENTRAL_DB_NAME: process.env.CENTRAL_DB_NAME as string,
  CENTRAL_DB_TABLE: process.env.CENTRAL_DB_TABLE as string,
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};
