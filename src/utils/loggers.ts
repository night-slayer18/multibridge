import winston from "winston";
import { envConfig } from "../config/envConfig";

const logger = winston.createLogger({
  level: envConfig.LOG_LEVEL,
  format: winston.format.combine(
    // Set a custom timestamp format
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
