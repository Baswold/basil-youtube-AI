import type { AdapterFactory, LlmAdapter, SttAdapter, TtsAdapter } from "./interfaces";

// Import adapters (these will be loaded lazily to avoid import errors if deps are missing)
import { ClaudeAdapter } from "./claude";
import { 
  OpenAICompatibleAdapter, 
  createGroqAdapter, 
  createTogetherAdapter,
  createLocalLlamaAdapter 
} from "./openai-compatible";

// Dynamic imports for optional dependencies
async function loadAssemblyAI() {
  const { AssemblyAISttAdapter } = await import("./stt-assemblyai");
  return AssemblyAISttAdapter;
}

async function loadGoogleStt() {
  const { GoogleSttAdapter } = await import("./stt-google");
  return GoogleSttAdapter;
}

async function loadWhisperStt() {
  const { WhisperSttAdapter } = await import("./stt-whisper");
  return WhisperSttAdapter;
}

async function loadGoogleTts() {
  const { GoogleTtsAdapter, createClaudeVoice, createGuestVoice } = await import("./tts-google");
  return { GoogleTtsAdapter, createClaudeVoice, createGuestVoice };
}

async function loadPiperTts() {
  const { PiperTtsAdapter, createClaudePiperVoice, createGuestPiperVoice } = await import("./tts-piper");
  return { PiperTtsAdapter, createClaudePiperVoice, createGuestPiperVoice };
}

export interface FactoryConfig {
  sttProvider?: "assemblyai" | "google" | "whisper";
  ttsProvider?: "google" | "piper";
  guestProvider?: "groq" | "together" | "local" | "openai";
  
  // API Keys
  anthropicApiKey?: string;
  assemblyaiApiKey?: string;
  groqApiKey?: string;
  togetherApiKey?: string;
  openaiApiKey?: string;
  
  // Google Cloud credentials are read from GOOGLE_APPLICATION_CREDENTIALS env var
  
  // Custom configurations
  whisperEndpoint?: string;
  piperPath?: string;
  piperModelPath?: string;
  localLlamaEndpoint?: string;
  guestModel?: string;
  
  // Callbacks
  onSttTranscript?: (sessionId: string, text: string, isFinal: boolean) => void;
  onSttError?: (sessionId: string, error: Error) => void;
  onTtsAudioChunk?: (sessionId: string, audioChunk: Buffer) => void;
  onTtsComplete?: (sessionId: string) => void;
  onTtsError?: (sessionId: string, error: Error) => void;
}

export class RealAdapterFactory implements AdapterFactory {
  private config: FactoryConfig;

  constructor(config: FactoryConfig = {}) {
    // Read from environment variables
    this.config = {
      sttProvider: (process.env.STT_PROVIDER as any) || "assemblyai",
      ttsProvider: (process.env.TTS_PROVIDER as any) || "google",
      guestProvider: (process.env.GUEST_PROVIDER as any) || "groq",
      
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      assemblyaiApiKey: process.env.ASSEMBLYAI_API_KEY,
      groqApiKey: process.env.GROQ_API_KEY,
      togetherApiKey: process.env.TOGETHER_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      
      whisperEndpoint: process.env.WHISPER_ENDPOINT || "http://localhost:8001/transcribe",
      piperPath: process.env.PIPER_PATH || "piper",
      piperModelPath: process.env.PIPER_MODEL_PATH,
      localLlamaEndpoint: process.env.LOCAL_LLAMA_ENDPOINT || "http://localhost:8080/v1",
      guestModel: process.env.GUEST_MODEL,
      
      ...config,
    };
  }

  stt(): SttAdapter {
    const provider = this.config.sttProvider!;
    
    switch (provider) {
      case "assemblyai": {
        if (!this.config.assemblyaiApiKey) {
          throw new Error("ASSEMBLYAI_API_KEY is required for AssemblyAI STT");
        }
        return loadAssemblyAI().then(AssemblyAISttAdapter => 
          new AssemblyAISttAdapter({
            apiKey: this.config.assemblyaiApiKey!,
            onTranscript: this.config.onSttTranscript,
            onError: this.config.onSttError,
          })
        ) as any; // Will be loaded async in practice
      }
      
      case "google": {
        return loadGoogleStt().then(GoogleSttAdapter =>
          new GoogleSttAdapter({
            onTranscript: this.config.onSttTranscript,
            onError: this.config.onSttError,
          })
        ) as any;
      }
      
      case "whisper": {
        return loadWhisperStt().then(WhisperSttAdapter =>
          new WhisperSttAdapter({
            endpoint: this.config.whisperEndpoint,
            onTranscript: this.config.onSttTranscript,
            onError: this.config.onSttError,
          })
        ) as any;
      }
      
      default:
        throw new Error(`Unknown STT provider: ${provider}`);
    }
  }

  tts(): TtsAdapter {
    const provider = this.config.ttsProvider!;
    
    switch (provider) {
      case "google": {
        return loadGoogleTts().then(({ createClaudeVoice }) =>
          createClaudeVoice()
        ) as any;
      }
      
      case "piper": {
        return loadPiperTts().then(({ createClaudePiperVoice }) =>
          createClaudePiperVoice(this.config.piperModelPath)
        ) as any;
      }
      
      default:
        throw new Error(`Unknown TTS provider: ${provider}`);
    }
  }

  llm(identifier: "claude" | "guest"): LlmAdapter {
    if (identifier === "claude") {
      if (!this.config.anthropicApiKey) {
        throw new Error("ANTHROPIC_API_KEY is required for Claude");
      }
      return new ClaudeAdapter({
        apiKey: this.config.anthropicApiKey,
      });
    }
    
    // Guest LLM
    const provider = this.config.guestProvider!;
    
    switch (provider) {
      case "groq": {
        if (!this.config.groqApiKey) {
          throw new Error("GROQ_API_KEY is required for Groq");
        }
        return createGroqAdapter(
          this.config.groqApiKey,
          this.config.guestModel
        );
      }
      
      case "together": {
        if (!this.config.togetherApiKey) {
          throw new Error("TOGETHER_API_KEY is required for Together");
        }
        return createTogetherAdapter(
          this.config.togetherApiKey,
          this.config.guestModel
        );
      }
      
      case "local": {
        return createLocalLlamaAdapter(
          this.config.localLlamaEndpoint,
          this.config.guestModel
        );
      }
      
      case "openai": {
        if (!this.config.openaiApiKey) {
          throw new Error("OPENAI_API_KEY is required for OpenAI");
        }
        return new OpenAICompatibleAdapter("openai", {
          apiKey: this.config.openaiApiKey,
          model: this.config.guestModel || "gpt-4o-mini",
        });
      }
      
      default:
        throw new Error(`Unknown guest provider: ${provider}`);
    }
  }
}
