import type { SttAdapter } from "./interfaces";

interface WhisperConfig {
  endpoint?: string;
  model?: string;
  onTranscript?: (sessionId: string, text: string, isFinal: boolean) => void;
  onError?: (sessionId: string, error: Error) => void;
}

/**
 * Adapter for local faster-whisper service.
 * Requires a separate faster-whisper HTTP service running (e.g., Python FastAPI server).
 * 
 * Expected endpoint: POST /transcribe with audio chunks
 * Response: { text: string, is_final: boolean }
 */
export class WhisperSttAdapter implements SttAdapter {
  private config: WhisperConfig;
  private activeSessions = new Set<string>();
  private audioBuffers = new Map<string, Buffer[]>();
  private processingIntervals = new Map<string, NodeJS.Timeout>();

  constructor(config: WhisperConfig = {}) {
    this.config = {
      endpoint: "http://localhost:8001/transcribe",
      model: "base",
      ...config,
    };
  }

  async start(sessionId: string): Promise<void> {
    if (this.activeSessions.has(sessionId)) {
      console.warn(`[whisper-stt] session ${sessionId} already active`);
      return;
    }

    this.activeSessions.add(sessionId);
    this.audioBuffers.set(sessionId, []);

    // Process audio chunks every 2 seconds
    const interval = setInterval(() => {
      this.processAudioBuffer(sessionId);
    }, 2000);

    this.processingIntervals.set(sessionId, interval);
    console.info(`[whisper-stt] session ${sessionId} started`);
  }

  async stop(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
    
    const interval = this.processingIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.processingIntervals.delete(sessionId);
    }

    // Process any remaining audio
    await this.processAudioBuffer(sessionId);
    this.audioBuffers.delete(sessionId);
    
    console.info(`[whisper-stt] session ${sessionId} stopped`);
  }

  sendAudio(sessionId: string, audioChunk: Buffer): void {
    const buffer = this.audioBuffers.get(sessionId);
    if (buffer) {
      buffer.push(audioChunk);
    }
  }

  private async processAudioBuffer(sessionId: string): Promise<void> {
    const chunks = this.audioBuffers.get(sessionId);
    if (!chunks || chunks.length === 0) {
      return;
    }

    const audioData = Buffer.concat(chunks);
    this.audioBuffers.set(sessionId, []); // Clear buffer

    try {
      const response = await fetch(this.config.endpoint!, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: audioData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as { text: string; is_final?: boolean };
      
      if (result.text && result.text.trim().length > 0) {
        this.config.onTranscript?.(sessionId, result.text, result.is_final ?? true);
      }
    } catch (error) {
      console.error(`[whisper-stt] error for ${sessionId}:`, error);
      this.config.onError?.(sessionId, error as Error);
    }
  }
}
