import { RealtimeTranscriber } from "assemblyai";
import type { SttAdapter } from "./interfaces";

interface AssemblyAIConfig {
  apiKey: string;
  sampleRate?: number;
  onTranscript?: (sessionId: string, text: string, isFinal: boolean) => void;
  onError?: (sessionId: string, error: Error) => void;
}

export class AssemblyAISttAdapter implements SttAdapter {
  private config: AssemblyAIConfig;
  private transcribers = new Map<string, RealtimeTranscriber>();

  constructor(config: AssemblyAIConfig) {
    this.config = {
      sampleRate: 16000,
      ...config,
    };
  }

  async start(sessionId: string): Promise<void> {
    if (this.transcribers.has(sessionId)) {
      console.warn(`[assemblyai-stt] session ${sessionId} already active`);
      return;
    }

    const transcriber = new RealtimeTranscriber({
      apiKey: this.config.apiKey,
      sampleRate: this.config.sampleRate,
    });

    transcriber.on("open", () => {
      console.info(`[assemblyai-stt] session ${sessionId} started`);
    });

    transcriber.on("transcript", (transcript) => {
      if (transcript.text && transcript.text.length > 0) {
        this.config.onTranscript?.(
          sessionId,
          transcript.text,
          transcript.message_type === "FinalTranscript"
        );
      }
    });

    transcriber.on("error", (error: Error) => {
      console.error(`[assemblyai-stt] error for ${sessionId}:`, error);
      this.config.onError?.(sessionId, error);
    });

    transcriber.on("close", () => {
      console.info(`[assemblyai-stt] session ${sessionId} closed`);
      this.transcribers.delete(sessionId);
    });

    await transcriber.connect();
    this.transcribers.set(sessionId, transcriber);
  }

  async stop(sessionId: string): Promise<void> {
    const transcriber = this.transcribers.get(sessionId);
    if (transcriber) {
      await transcriber.close();
      this.transcribers.delete(sessionId);
    }
  }

  sendAudio(sessionId: string, audioChunk: Buffer): void {
    const transcriber = this.transcribers.get(sessionId);
    if (transcriber) {
      transcriber.sendAudio(audioChunk);
    }
  }
}
