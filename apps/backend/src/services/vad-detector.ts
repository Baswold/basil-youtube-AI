import type { SpeakerId } from "@basil/shared";

export interface VadDetectorOptions {
  sampleRate?: number;
  frameDurationMs?: number;
  speechThreshold?: number;
  releaseThreshold?: number;
  minSpeechMs?: number;
  minSilenceMs?: number;
  targetSpeaker?: SpeakerId;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

/**
 * Lightweight energy-based VAD suitable for realtime ducking decisions.
 *
 * The detector assumes 16-bit little-endian PCM audio at a fixed sample rate.
 * It keeps a rolling tally of frame energy and fires start/end callbacks once
 * the configured thresholds are exceeded for the requisite number of frames.
 */
export class VadDetector {
  private readonly sampleRate: number;
  private readonly frameSamples: number;
  private readonly speechThreshold: number;
  private readonly releaseThreshold: number;
  private readonly minSpeechFrames: number;
  private readonly minSilenceFrames: number;
  private readonly onSpeechStart?: () => void;
  private readonly onSpeechEnd?: () => void;

  private speechFrameCount = 0;
  private silenceFrameCount = 0;
  private speaking = false;

  constructor(options: VadDetectorOptions = {}) {
    this.sampleRate = options.sampleRate ?? 48_000;
    const frameDurationMs = options.frameDurationMs ?? 20;
    this.frameSamples = Math.floor((this.sampleRate / 1_000) * frameDurationMs);

    this.speechThreshold = options.speechThreshold ?? 0.015; // Rough RMS limit
    this.releaseThreshold = options.releaseThreshold ?? 0.008;

    const minSpeechMs = options.minSpeechMs ?? 120;
    const minSilenceMs = options.minSilenceMs ?? 220;

    this.minSpeechFrames = Math.max(1, Math.floor(minSpeechMs / frameDurationMs));
    this.minSilenceFrames = Math.max(1, Math.floor(minSilenceMs / frameDurationMs));

    this.onSpeechStart = options.onSpeechStart;
    this.onSpeechEnd = options.onSpeechEnd;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  reset(): void {
    this.speechFrameCount = 0;
    this.silenceFrameCount = 0;
    this.speaking = false;
  }

  processAudio(buffer: Buffer): void {
    if (buffer.length === 0) return;

    const sampleCount = buffer.length / 2; // 16-bit PCM, little-endian
    if (!Number.isInteger(sampleCount)) {
      console.warn("[vad] Received chunk with unexpected byte length", buffer.length);
      return;
    }

    for (let offset = 0; offset < sampleCount; offset += this.frameSamples) {
      const frameSize = Math.min(this.frameSamples, sampleCount - offset);
      if (frameSize <= 0) break;

      const rms = this.computeRms(buffer, offset, frameSize);

      if (rms >= this.speechThreshold) {
        this.speechFrameCount += 1;
        this.silenceFrameCount = 0;

        if (!this.speaking && this.speechFrameCount >= this.minSpeechFrames) {
          this.speaking = true;
          this.onSpeechStart?.();
        }
      } else if (rms <= this.releaseThreshold) {
        if (this.speaking) {
          this.silenceFrameCount += 1;
          if (this.silenceFrameCount >= this.minSilenceFrames) {
            this.speaking = false;
            this.speechFrameCount = 0;
            this.silenceFrameCount = 0;
            this.onSpeechEnd?.();
          }
        } else {
          this.speechFrameCount = 0;
        }
      } else {
        // Intermediate region; keep prior state but decay speech count gradually
        this.speechFrameCount = Math.max(0, this.speechFrameCount - 1);
      }
    }
  }

  private computeRms(buffer: Buffer, startSample: number, frameSize: number): number {
    let energy = 0;
    const startByte = startSample * 2;

    for (let i = 0; i < frameSize; i++) {
      const byteIndex = startByte + i * 2;
      const sample = buffer.readInt16LE(byteIndex);
      const normalized = sample / 32_768; // Normalize to [-1, 1)
      energy += normalized * normalized;
    }

    const meanSquare = energy / frameSize;
    return Math.sqrt(meanSquare);
  }
}
