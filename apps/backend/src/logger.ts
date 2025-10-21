import pino from "pino";

/**
 * Configured pino logger instance
 * - JSON format for structured logging
 * - Log level determined by NODE_ENV
 * - Request IDs automatically included via pino-http
 */
export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
});
