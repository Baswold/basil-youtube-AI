import textToSpeech from "@google-cloud/text-to-speech";
import type { SpeakerId } from "@basil/shared";
import type { TtsAdapter } from "./interfaces";

interface GoogleTtsConfig {
  speaker?: Exclude<SpeakerId, "you">;
  languageCode?: string;
  voiceName?: string;
  speakingRate?: number;
  pitch?: number;
  onAudioChunk?: (sessionId: string, speaker: Exclude<SpeakerId, "you">, audioChunk: Buffer) => void;
  onComplete?: (sessionId: string, speaker: Exclude<SpeakerId, "you">) => void;
  onError?: (sessionId: string, speaker: Exclude<SpeakerId, "you">, error: Error) => void;
}

export class GoogleTtsAdapter implements TtsAdapter {
  private client: textToSpeech.TextToSpeechClient;
  private config: GoogleTtsConfig;
  private activeSessions = new Set<string>();

  constructor(config: GoogleTtsConfig = {}) {
    this.config = {
      languageCode: "en-US",
      voiceName: "en-US-Neural2-J", // Male voice
      speakingRate: 1.0,
      pitch: 0.0,
      ...config,
    };
    this.client = new textToSpeech.TextToSpeechClient();
  }

  async synthesize(sessionId: string, text: string): Promise<void> {
    if (this.activeSessions.has(sessionId)) {
      console.warn(`[google-tts] session ${sessionId} already synthesizing`);
      return;
    }

    this.activeSessions.add(sessionId);

    try {
      const request = {
        input: { text },
        voice: {
          languageCode: this.config.languageCode,
          name: this.config.voiceName,
        },
        audioConfig: {
          audioEncoding: "LINEAR16" as const,
          speakingRate: this.config.speakingRate,
          pitch: this.config.pitch,
          sampleRateHertz: 48000,
        },
      };

      const [response] = await this.client.synthesizeSpeech(request);

      if (response.audioContent) {
        const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
        
        // Send audio in chunks to simulate streaming
        const chunkSize = 4096;
        for (let i = 0; i < audioBuffer.length; i += chunkSize) {
          const chunk = audioBuffer.slice(i, i + chunkSize);
          this.config.onAudioChunk?.(sessionId, this.config.speaker ?? "claude", chunk);
          
          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        this.config.onComplete?.(sessionId, this.config.speaker ?? "claude");
      }
    } catch (error) {
      console.error(`[google-tts] error for ${sessionId}:`, error);
      this.config.onError?.(sessionId, this.config.speaker ?? "claude", error as Error);
    } finally {
      this.activeSessions.delete(sessionId);
    }
  }

  async stop(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
    console.info(`[google-tts] stopped ${sessionId}`);
  }
}

// Voice presets for different speakers
export function createClaudeVoice(): GoogleTtsAdapter {
  return new GoogleTtsAdapter({
    speaker: "claude",
    voiceName: "en-US-Neural2-D", // Warm, professional male voice
    speakingRate: 1.05,
    pitch: -1.0,
  });
}

export function createGuestVoice(): GoogleTtsAdapter {
  return new GoogleTtsAdapter({
    speaker: "guest",
    voiceName: "en-US-Neural2-A", // Clear, engaging male voice
    speakingRate: 1.0,
    pitch: 0.5,
  });
}
