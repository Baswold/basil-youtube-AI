import speech from "@google-cloud/speech";
import type { SttAdapter } from "./interfaces";

interface GoogleSttConfig {
  languageCode?: string;
  sampleRateHertz?: number;
  encoding?: string;
  onTranscript?: (sessionId: string, text: string, isFinal: boolean) => void;
  onError?: (sessionId: string, error: Error) => void;
}

export class GoogleSttAdapter implements SttAdapter {
  private client: speech.SpeechClient;
  private config: GoogleSttConfig;
  private streams = new Map<string, any>();

  constructor(config: GoogleSttConfig = {}) {
    this.config = {
      languageCode: "en-US",
      sampleRateHertz: 16000,
      encoding: "LINEAR16",
      ...config,
    };
    this.client = new speech.SpeechClient();
  }

  async start(sessionId: string): Promise<void> {
    if (this.streams.has(sessionId)) {
      console.warn(`[google-stt] session ${sessionId} already active`);
      return;
    }

    const request = {
      config: {
        encoding: this.config.encoding as any,
        sampleRateHertz: this.config.sampleRateHertz,
        languageCode: this.config.languageCode,
      },
      interimResults: true,
    };

    const recognizeStream = this.client
      .streamingRecognize(request)
      .on("error", (error: Error) => {
        console.error(`[google-stt] error for ${sessionId}:`, error);
        this.config.onError?.(sessionId, error);
      })
      .on("data", (data: any) => {
        const result = data.results[0];
        if (result && result.alternatives[0]) {
          const transcript = result.alternatives[0].transcript;
          const isFinal = result.isFinal;
          this.config.onTranscript?.(sessionId, transcript, isFinal);
        }
      });

    this.streams.set(sessionId, recognizeStream);
    console.info(`[google-stt] session ${sessionId} started`);
  }

  async stop(sessionId: string): Promise<void> {
    const stream = this.streams.get(sessionId);
    if (stream) {
      stream.end();
      this.streams.delete(sessionId);
      console.info(`[google-stt] session ${sessionId} stopped`);
    }
  }

  sendAudio(sessionId: string, audioChunk: Buffer): void {
    const stream = this.streams.get(sessionId);
    if (stream) {
      stream.write(audioChunk);
    }
  }
}
