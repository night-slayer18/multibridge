import winston from "winston";
import { envConfig } from "../config/envConfig";

const logger = winston.createLogger({
  level: envConfig.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      ({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`
    )
  ),
  transports: [new winston.transports.Console()],
});

export default logger;