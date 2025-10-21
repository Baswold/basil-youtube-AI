import { spawn } from "node:child_process";
import type { TtsAdapter } from "./interfaces";

interface PiperConfig {
  piperPath?: string;
  modelPath?: string;
  speakingRate?: number;
  onAudioChunk?: (sessionId: string, audioChunk: Buffer) => void;
  onComplete?: (sessionId: string) => void;
  onError?: (sessionId: string, error: Error) => void;
}

/**
 * Adapter for local Piper TTS.
 * Requires Piper binary installed: https://github.com/rhasspy/piper
 * 
 * Install with: pip install piper-tts
 * Download models from: https://github.com/rhasspy/piper/releases
 */
export class PiperTtsAdapter implements TtsAdapter {
  private config: PiperConfig;
  private activeSessions = new Set<string>();

  constructor(config: PiperConfig = {}) {
    this.config = {
      piperPath: "piper",
      modelPath: "./models/en_US-lessac-medium.onnx",
      speakingRate: 1.0,
      ...config,
    };
  }

  async synthesize(sessionId: string, text: string): Promise<void> {
    if (this.activeSessions.has(sessionId)) {
      console.warn(`[piper-tts] session ${sessionId} already synthesizing`);
      return;
    }

    this.activeSessions.add(sessionId);

    try {
      await this.runPiper(sessionId, text);
    } catch (error) {
      console.error(`[piper-tts] error for ${sessionId}:`, error);
      this.config.onError?.(sessionId, error as Error);
    } finally {
      this.activeSessions.delete(sessionId);
    }
  }

  async stop(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
    console.info(`[piper-tts] stopped ${sessionId}`);
  }

  private async runPiper(sessionId: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        "--model", this.config.modelPath!,
        "--output-raw",
        "--length-scale", (1.0 / this.config.speakingRate!).toString(),
      ];

      const piper = spawn(this.config.piperPath!, args);
      const audioChunks: Buffer[] = [];

      piper.stdout.on("data", (chunk: Buffer) => {
        audioChunks.push(chunk);
        this.config.onAudioChunk?.(sessionId, chunk);
      });

      piper.stderr.on("data", (data: Buffer) => {
        console.error(`[piper-tts] stderr: ${data.toString()}`);
      });

      piper.on("error", (error: Error) => {
        reject(error);
      });

      piper.on("close", (code: number) => {
        if (code === 0) {
          this.config.onComplete?.(sessionId);
          resolve();
        } else {
          reject(new Error(`Piper exited with code ${code}`));
        }
      });

      // Write text to stdin and close
      piper.stdin.write(text);
      piper.stdin.end();
    });
  }
}

// Voice presets for different speakers using different models
export function createClaudePiperVoice(modelPath?: string): PiperTtsAdapter {
  return new PiperTtsAdapter({
    modelPath: modelPath || "./models/en_US-lessac-medium.onnx",
    speakingRate: 1.05,
  });
}

export function createGuestPiperVoice(modelPath?: string): PiperTtsAdapter {
  return new PiperTtsAdapter({
    modelPath: modelPath || "./models/en_US-libritts-high.onnx",
    speakingRate: 1.0,
  });
}
