import type { AdapterFactory, LlmAdapter, SttAdapter, TtsAdapter } from "./interfaces";
import type { SpeakerId } from "@basil/shared";

// Import adapters (these will be loaded lazily to avoid import errors if deps are missing)
import { ClaudeAdapter } from "./claude";
import { 
  OpenAICompatibleAdapter, 
  createGroqAdapter,
  createGrokAdapter,
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
  return import("./tts-google");
}

async function loadCoquiTts() {
  return import("./tts-coqui");
}

export interface FactoryConfig {
  sttProvider?: "assemblyai" | "google" | "whisper";
  ttsProvider?: "google" | "coqui";
  guestProvider?: "groq" | "grok" | "together" | "local" | "openai";
  
  // API Keys
  anthropicApiKey?: string;
  assemblyaiApiKey?: string;
  groqApiKey?: string;
  grokApiKey?: string;
  togetherApiKey?: string;
  openaiApiKey?: string;
  
  // Google Cloud credentials are read from GOOGLE_APPLICATION_CREDENTIALS env var
  
  // Custom configurations
  whisperEndpoint?: string;
  localLlamaEndpoint?: string;
  guestModel?: string;
  
  // Guest voice customization
  guestVoiceProvider?: "google" | "coqui";
  guestGoogleVoice?: string;
  guestCoquiSpeaker?: string;
  guestSpeakingRate?: number;
  guestPitch?: number;

  // EchoForge integration for custom voice cloning
  echoforgeEndpoint?: string;
  claudeVoiceProfileId?: number;
  guestVoiceProfileId?: number;
  
  // Callbacks
  onSttTranscript?: (sessionId: string, text: string, isFinal: boolean) => void;
  onSttError?: (sessionId: string, error: Error) => void;
  onTtsAudioChunk?: (sessionId: string, speaker: Exclude<SpeakerId, "you">, audioChunk: Buffer) => void;
  onTtsComplete?: (sessionId: string, speaker: Exclude<SpeakerId, "you">) => void;
  onTtsError?: (sessionId: string, speaker: Exclude<SpeakerId, "you">, error: Error) => void;
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
      grokApiKey: process.env.GROK_API_KEY,
      togetherApiKey: process.env.TOGETHER_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,

      whisperEndpoint: process.env.WHISPER_ENDPOINT || "http://localhost:8001/transcribe",
      localLlamaEndpoint: process.env.LOCAL_LLAMA_ENDPOINT || "http://localhost:8080/v1",
      guestModel: process.env.GUEST_MODEL,

      // EchoForge configuration
      echoforgeEndpoint: process.env.ECHOFORGE_ENDPOINT || "http://localhost:8000",
      claudeVoiceProfileId: process.env.CLAUDE_VOICE_PROFILE_ID ? parseInt(process.env.CLAUDE_VOICE_PROFILE_ID) : undefined,
      guestVoiceProfileId: process.env.GUEST_VOICE_PROFILE_ID ? parseInt(process.env.GUEST_VOICE_PROFILE_ID) : undefined,

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

  tts(speaker: Exclude<SpeakerId, "you"> = "claude"): TtsAdapter {
    if (speaker === "guest") {
      return this.createGuestTts();
    }
    return this.createHostTts("claude");
  }

  // Create guest TTS adapter with custom voice settings
  guestTts(): TtsAdapter {
    return this.createGuestTts();
  }

  private createHostTts(speaker: Exclude<SpeakerId, "you">): TtsAdapter {
    const provider = this.config.ttsProvider!;

    switch (provider) {
      case "google": {
        return loadGoogleTts().then(({ GoogleTtsAdapter }) =>
          new GoogleTtsAdapter({
            speaker,
            voiceName: "en-US-Neural2-D",
            speakingRate: 1.05,
            pitch: -1.0,
            onAudioChunk: (sessionId, chunk) =>
              this.config.onTtsAudioChunk?.(sessionId, speaker, chunk),
            onComplete: (sessionId) =>
              this.config.onTtsComplete?.(sessionId, speaker),
            onError: (sessionId, error) =>
              this.config.onTtsError?.(sessionId, speaker, error),
          })
        ) as any;
      }

      case "coqui": {
        return loadCoquiTts().then(({ CoquiTtsAdapter }) =>
          new CoquiTtsAdapter({
            speaker,
            modelName: "tts_models/en/vctk/vits",
            speakerIdx: "VCTK_p226", // 22 year old male, English accent (Surrey)
            speakingRate: 1.05,
            // EchoForge integration (if configured)
            echoforgeEndpoint: this.config.echoforgeEndpoint,
            voiceProfileId: this.config.claudeVoiceProfileId,
            onAudioChunk: (sessionId, chunk) =>
              this.config.onTtsAudioChunk?.(sessionId, speaker, chunk),
            onComplete: (sessionId) =>
              this.config.onTtsComplete?.(sessionId, speaker),
            onError: (sessionId, error) =>
              this.config.onTtsError?.(sessionId, speaker, error),
          })
        ) as any;
      }

      default:
        throw new Error(`Unknown TTS provider: ${provider}`);
    }
  }

  private createGuestTts(): TtsAdapter {
    const provider = this.config.guestVoiceProvider || this.config.ttsProvider || "google";
    const speaker: Exclude<SpeakerId, "you"> = "guest";

    switch (provider) {
      case "google": {
        return loadGoogleTts().then(({ GoogleTtsAdapter }) =>
          new GoogleTtsAdapter({
            speaker,
            voiceName: this.config.guestGoogleVoice || "en-US-Neural2-A",
            speakingRate: this.config.guestSpeakingRate ?? 1.0,
            pitch: this.config.guestPitch ?? 0.5,
            onAudioChunk: (sessionId, chunk) =>
              this.config.onTtsAudioChunk?.(sessionId, speaker, chunk),
            onComplete: (sessionId) =>
              this.config.onTtsComplete?.(sessionId, speaker),
            onError: (sessionId, error) =>
              this.config.onTtsError?.(sessionId, speaker, error),
          })
        ) as any;
      }

      case "coqui": {
        return loadCoquiTts().then(({ CoquiTtsAdapter }) =>
          new CoquiTtsAdapter({
            speaker,
            modelName: "tts_models/en/vctk/vits",
            speakerIdx: this.config.guestCoquiSpeaker || "VCTK_p225", // 23 year old female, English accent
            speakingRate: this.config.guestSpeakingRate ?? 1.0,
            // EchoForge integration (if configured)
            echoforgeEndpoint: this.config.echoforgeEndpoint,
            voiceProfileId: this.config.guestVoiceProfileId,
            onAudioChunk: (sessionId, chunk) =>
              this.config.onTtsAudioChunk?.(sessionId, speaker, chunk),
            onComplete: (sessionId) =>
              this.config.onTtsComplete?.(sessionId, speaker),
            onError: (sessionId, error) =>
              this.config.onTtsError?.(sessionId, speaker, error),
          })
        ) as any;
      }

      default:
        throw new Error(`Unknown TTS provider for guest: ${provider}`);
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
      
      case "grok": {
        if (!this.config.grokApiKey) {
          throw new Error("GROK_API_KEY is required for Grok");
        }
        return createGrokAdapter(
          this.config.grokApiKey,
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
