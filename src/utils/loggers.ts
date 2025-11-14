import winston from "winston";
import { envConfig } from "../config/envConfig";

// Custom format to handle structured logging with context
const customFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  // Extract context from meta if present
  const context = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : "";
  const contextStr = context ? `\nContext: ${context}` : "";
  return `${timestamp} [${level.toUpperCase()}]: ${message}${contextStr}`;
});

const logger = winston.createLogger({
  level: envConfig.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }), // Include stack traces
    customFormat
  ),
  transports: [new winston.transports.Console()],
});

// Extend logger methods to accept context objects
// Note: Winston's log method signature is complex, so we'll use the existing methods
// and rely on the custom format to handle context objects passed as second parameter

export default logger;
