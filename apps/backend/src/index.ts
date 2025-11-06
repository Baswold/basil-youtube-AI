import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { z } from "zod";
import { ProductionOrchestrator } from "./orchestrator-v2.js";
import type { ClientToServerEvents, ServerToClientEvents } from "@basil/shared";
import { appConfig, validateConfig, printConfig } from "./config.js";
import { logger } from "./logger.js";
import { setupApiRoutes } from "./api-routes.js";

// Validate configuration on startup
try {
  validateConfig();
  printConfig();
} catch (error) {
  console.error("Fatal configuration error:", error);
  process.exit(1);
}

const app = express();

// Security middleware
app.use(helmet());

// Request logging with pino-http (with field redaction)
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === "/health" || req.url === "/ready" },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers['*_api_key']",
      ],
      remove: true,
    },
  })
);

// CORS middleware
app.use(
  cors({
    origin: appConfig.corsOrigin,
    credentials: true,
  })
);

// Body size limit
app.use(express.json({ limit: "1mb" }));

// Rate limiting: 100 requests per 15 minutes per IP
// Skip for WebSocket upgrade path
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => req.url === "/socket.io", // Skip WebSocket upgrade
});
app.use(limiter);

// Input validation schemas
const healthQuerySchema = z.object({}).strict();
const readyQuerySchema = z.object({}).strict();

// Health check endpoint
app.get("/health", (req, res) => {
  try {
    healthQuerySchema.parse(req.query);
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      adapters: {
        enabled: appConfig.useRealAdapters,
        stt: appConfig.sttProvider,
        tts: appConfig.ttsProvider,
        guest: appConfig.guestProvider,
      },
    });
  } catch (error) {
    logger.error({ error }, "Invalid query parameters for /health");
    res.status(400).json({ error: "Invalid query parameters" });
  }
});

// Ready check endpoint
app.get("/ready", (req, res) => {
  try {
    readyQuerySchema.parse(req.query);
    res.json({ status: "ready" });
  } catch (error) {
    logger.error({ error }, "Invalid query parameters for /ready");
    res.status(400).json({ error: "Invalid query parameters" });
  }
});

// Setup API routes for configuration management
setupApiRoutes(app);

// Global error handler middleware
app.use(
  (
    err: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const status = err.status || 500;
    logger.error(
      {
        error: err,
        status,
        message: err.message,
      },
      "Unhandled error in request"
    );
    res.status(status).json({
      error: "Internal server error",
      status,
    });
  }
);

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: appConfig.corsOrigin,
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const orchestrator = new ProductionOrchestrator({
  useRealAdapters: appConfig.useRealAdapters,
  recordingDir: appConfig.recordingDir,
});

io.on("connection", async (socket) => {
  logger.info({ socketId: socket.id }, "New socket.io connection");

  try {
    await orchestrator.register(socket);
  } catch (error) {
    logger.error(
      { socketId: socket.id, error },
      "Failed to register socket"
    );
    socket.disconnect(true);
  }
});

// Error handling
io.on("error", (error) => {
  logger.error({ error }, "Socket.IO error");
});

const server = httpServer.listen(appConfig.port, () => {
  console.info(`✅ Backend listening on http://localhost:${appConfig.port}`);
  console.info(`   WebSocket ready for connections`);
  console.info(`   Health check: http://localhost:${appConfig.port}/health`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.info(`\n[server] ${signal} received, shutting down gracefully...`);
  
  // Stop accepting new connections
  server.close(async () => {
    console.info("[server] HTTP server closed");
    
    try {
      // Cleanup orchestrator and active sessions
      await orchestrator.shutdown();
      console.info("[server] Orchestrator shutdown complete");
      
      // Close Socket.IO
      io.close(() => {
        console.info("[server] Socket.IO closed");
        process.exit(0);
      });
    } catch (error) {
      console.error("[server] Error during shutdown:", error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error("[server] Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[server] Uncaught exception:", error);
  shutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[server] Unhandled rejection at:", promise, "reason:", reason);
  shutdown("UNHANDLED_REJECTION");
});
