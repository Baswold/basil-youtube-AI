import textToSpeech from "@google-cloud/text-to-speech";
import type { TtsAdapter } from "./interfaces";

interface GoogleTtsConfig {
  languageCode?: string;
  voiceName?: string;
  speakingRate?: number;
  pitch?: number;
  onAudioChunk?: (sessionId: string, audioChunk: Buffer) => void;
  onComplete?: (sessionId: string) => void;
  onError?: (sessionId: string, error: Error) => void;
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
          this.config.onAudioChunk?.(sessionId, chunk);
          
          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        this.config.onComplete?.(sessionId);
      }
    } catch (error) {
      console.error(`[google-tts] error for ${sessionId}:`, error);
      this.config.onError?.(sessionId, error as Error);
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
    voiceName: "en-US-Neural2-D", // Warm, professional male voice
    speakingRate: 1.05,
    pitch: -1.0,
  });
}

export function createGuestVoice(): GoogleTtsAdapter {
  return new GoogleTtsAdapter({
    voiceName: "en-US-Neural2-A", // Clear, engaging male voice
    speakingRate: 1.0,
    pitch: 0.5,
  });
}
