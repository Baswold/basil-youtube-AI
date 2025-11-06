import { config as loadEnv } from "dotenv";

// Load environment variables
loadEnv();

interface AppConfig {
  // Server
  port: number;
  corsOrigin: string[];
  nodeEnv: string;

  // Features
  useRealAdapters: boolean;
  
  // Adapters
  sttProvider: "assemblyai" | "google" | "whisper";
  ttsProvider: "google" | "coqui";
  guestProvider: "groq" | "grok" | "together" | "local" | "openai";

  // API Keys
  anthropicApiKey?: string;
  assemblyaiApiKey?: string;
  groqApiKey?: string;
  grokApiKey?: string;
  togetherApiKey?: string;
  openaiApiKey?: string;
  googleCredentials?: string;

  // Service Endpoints
  whisperEndpoint: string;
  localLlamaEndpoint: string;

  // Guest Model
  guestModel?: string;

  // Recording
  recordingDir: string;
  briefingsDir: string;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value ?? defaultValue!;
}

function getOptionalEnv(key: string): string | undefined {
  return process.env[key];
}

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

export function validateConfig(): void {
  const errors: string[] = [];

  // Validate based on providers
  if (appConfig.useRealAdapters) {
    // Claude is always required
    if (!appConfig.anthropicApiKey) {
      errors.push("ANTHROPIC_API_KEY is required when using real adapters");
    }

    // STT validation
    if (appConfig.sttProvider === "assemblyai" && !appConfig.assemblyaiApiKey) {
      errors.push("ASSEMBLYAI_API_KEY is required for AssemblyAI STT");
    }

    // Guest LLM validation
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
