import { config as loadEnv } from "dotenv";

// Load environment variables from .env file
loadEnv();

/**
 * Application configuration interface
 * All configuration values are loaded from environment variables
 */
interface AppConfig {
  // =================
  // Server Configuration
  // =================

  /** Port number for the Express server */
  port: number;
  /** Allowed CORS origins (comma-separated in env) */
  corsOrigin: string[];
  /** Node environment (development, production, test) */
  nodeEnv: string;

  // =================
  // Feature Flags
  // =================

  /** Whether to use real external adapters or mocks */
  useRealAdapters: boolean;

  // =================
  // Adapter Selection
  // =================

  /** Speech-to-Text provider */
  sttProvider: "assemblyai" | "google" | "whisper";
  /** Text-to-Speech provider */
  ttsProvider: "google" | "coqui";
  /** Guest LLM provider */
  guestProvider: "groq" | "grok" | "together" | "local" | "openai";

  // =================
  // API Keys (all optional, validated based on selected providers)
  // =================

  /** Anthropic API key (required for Claude) */
  anthropicApiKey?: string;
  /** AssemblyAI API key (required if STT_PROVIDER=assemblyai) */
  assemblyaiApiKey?: string;
  /** Groq API key (required if GUEST_PROVIDER=groq) */
  groqApiKey?: string;
  /** Grok API key (required if GUEST_PROVIDER=grok) */
  grokApiKey?: string;
  /** Together.ai API key (required if GUEST_PROVIDER=together) */
  togetherApiKey?: string;
  /** OpenAI API key (required if GUEST_PROVIDER=openai) */
  openaiApiKey?: string;
  /** Path to Google Cloud credentials JSON file */
  googleCredentials?: string;

  // =================
  // Service Endpoints (for local/self-hosted services)
  // =================

  /** Endpoint for local Whisper STT service */
  whisperEndpoint: string;
  /** Endpoint for local llama.cpp server */
  localLlamaEndpoint: string;

  // =================
  // Model Configuration
  // =================

  /** Specific model name for guest LLM (overrides provider default) */
  guestModel?: string;

  // =================
  // Storage Paths
  // =================

  /** Directory where recordings, captions, and logs are stored */
  recordingDir: string;
  /** Directory containing episode briefing files */
  briefingsDir: string;
}

/**
 * Retrieves a required environment variable
 * @throws Error if the variable is not set and no default is provided
 */
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value ?? defaultValue!;
}

/**
 * Retrieves an optional environment variable
 * @returns The value or undefined if not set
 */
function getOptionalEnv(key: string): string | undefined {
  return process.env[key];
}

/**
 * Global application configuration
 * Loaded from environment variables at startup
 */
export const appConfig: AppConfig = {
  // Server
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
  nodeEnv: process.env.NODE_ENV || "development",

  // Features
  useRealAdapters: process.env.USE_REAL_ADAPTERS === "true",

  // Adapters
  sttProvider: (process.env.STT_PROVIDER as any) || "assemblyai",
  ttsProvider: (process.env.TTS_PROVIDER as any) || "coqui",
  guestProvider: (process.env.GUEST_PROVIDER as any) || "groq",

  // API Keys
  anthropicApiKey: getOptionalEnv("ANTHROPIC_API_KEY"),
  assemblyaiApiKey: getOptionalEnv("ASSEMBLYAI_API_KEY"),
  groqApiKey: getOptionalEnv("GROQ_API_KEY"),
  grokApiKey: getOptionalEnv("GROK_API_KEY"),
  togetherApiKey: getOptionalEnv("TOGETHER_API_KEY"),
  openaiApiKey: getOptionalEnv("OPENAI_API_KEY"),
  googleCredentials: getOptionalEnv("GOOGLE_APPLICATION_CREDENTIALS"),

  // Service Endpoints
  whisperEndpoint: process.env.WHISPER_ENDPOINT || "http://localhost:8001/transcribe",
  localLlamaEndpoint: process.env.LOCAL_LLAMA_ENDPOINT || "http://localhost:8080/v1",

  // Guest Model
  guestModel: getOptionalEnv("GUEST_MODEL"),

  // Recording
  recordingDir: process.env.RECORDING_DIR || "./recordings",
  briefingsDir: process.env.BRIEFINGS_DIR || "./briefings",
};

/**
 * Validates the configuration based on selected providers
 * Ensures all required API keys are present for the chosen adapters
 * @throws Error if configuration is invalid
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Validate based on providers
  if (appConfig.useRealAdapters) {
    // Claude is always required as the primary co-host
    if (!appConfig.anthropicApiKey) {
      errors.push("ANTHROPIC_API_KEY is required when using real adapters");
    }

    // STT validation - check for provider-specific keys
    if (appConfig.sttProvider === "assemblyai" && !appConfig.assemblyaiApiKey) {
      errors.push("ASSEMBLYAI_API_KEY is required for AssemblyAI STT");
    }

    // Guest LLM validation - each provider needs its own key
    if (appConfig.guestProvider === "groq" && !appConfig.groqApiKey) {
      errors.push("GROQ_API_KEY is required for Groq guest LLM");
    } else if (appConfig.guestProvider === "grok" && !appConfig.grokApiKey) {
      errors.push("GROK_API_KEY is required for Grok guest LLM");
    } else if (appConfig.guestProvider === "together" && !appConfig.togetherApiKey) {
      errors.push("TOGETHER_API_KEY is required for Together.ai guest LLM");
    } else if (appConfig.guestProvider === "openai" && !appConfig.openaiApiKey) {
      errors.push("OPENAI_API_KEY is required for OpenAI guest LLM");
    }
  }

  if (errors.length > 0) {
    console.error("Configuration validation failed:");
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error("Invalid configuration. Please check your .env file.");
  }
}

/**
 * Prints the current configuration to the console
 * Useful for debugging and verifying settings at startup
 */
export function printConfig(): void {
  console.info("=".repeat(60));
  console.info("Backend Configuration");
  console.info("=".repeat(60));
  console.info(`Environment:       ${appConfig.nodeEnv}`);
  console.info(`Port:              ${appConfig.port}`);
  console.info(`CORS Origins:      ${appConfig.corsOrigin.join(", ")}`);
  console.info(`Use Real Adapters: ${appConfig.useRealAdapters}`);

  if (appConfig.useRealAdapters) {
    console.info(`STT Provider:      ${appConfig.sttProvider}`);
    console.info(`TTS Provider:      ${appConfig.ttsProvider}`);
    console.info(`Guest Provider:    ${appConfig.guestProvider}`);
    if (appConfig.guestModel) {
      console.info(`Guest Model:       ${appConfig.guestModel}`);
    }
  }

  console.info(`Recording Dir:     ${appConfig.recordingDir}`);
  console.info(`Briefings Dir:     ${appConfig.briefingsDir}`);
  console.info("=".repeat(60));
}
