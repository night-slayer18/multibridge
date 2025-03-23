import dotenv from "dotenv";
import path from "path";

// Directly specify the path to your .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const envConfig = {
  CENTRAL_DB_HOST: process.env.CENTRAL_DB_HOST || "localhost",
  CENTRAL_DB_PORT: process.env.CENTRAL_DB_PORT ? parseInt(process.env.CENTRAL_DB_PORT) : 5432,
  CENTRAL_DB_USER: process.env.CENTRAL_DB_USER || "admin",
  CENTRAL_DB_PASSWORD: process.env.CENTRAL_DB_PASSWORD || "password",
  CENTRAL_DB_NAME: process.env.CENTRAL_DB_NAME || "dbname",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};
