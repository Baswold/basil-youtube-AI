import { describe, it, expect, vi } from "vitest";
import { VadDetector } from "./vad-detector";

function createPcmChunk(value: number, frames: number, frameSamples: number): Buffer {
  const totalSamples = frames * frameSamples;
  const buffer = Buffer.alloc(totalSamples * 2);
  const intValue = Math.max(-1, Math.min(1, value)) * 32767;

  for (let i = 0; i < totalSamples; i++) {
    buffer.writeInt16LE(intValue, i * 2);
  }

  return buffer;
}

describe("VadDetector", () => {
  it("should trigger speech start after consecutive loud frames", () => {
    const start = vi.fn();
    const end = vi.fn();

    const detector = new VadDetector({
      onSpeechStart: start,
      onSpeechEnd: end,
      frameDurationMs: 20,
      minSpeechMs: 60,
      minSilenceMs: 80,
    });

    const frameSamples = Math.floor((48_000 / 1_000) * 20);

    // First process silence
    detector.processAudio(createPcmChunk(0.001, 3, frameSamples));
    expect(start).not.toHaveBeenCalled();

    // Now loud audio for three frames (>= minSpeechMs) should trigger start
    detector.processAudio(createPcmChunk(0.05, 3, frameSamples));
    expect(start).toHaveBeenCalledTimes(1);
    expect(detector.isSpeaking()).toBe(true);
    expect(end).not.toHaveBeenCalled();
  });

  it("should trigger speech end after silence", () => {
    const start = vi.fn();
    const end = vi.fn();

    const detector = new VadDetector({
      onSpeechStart: start,
      onSpeechEnd: end,
      frameDurationMs: 20,
      minSpeechMs: 40,
      minSilenceMs: 60,
    });

    const frameSamples = Math.floor((48_000 / 1_000) * 20);

    // Trigger speech start
    detector.processAudio(createPcmChunk(0.05, 4, frameSamples));
    expect(start).toHaveBeenCalledTimes(1);

    // Provide silence frames to end speech
    detector.processAudio(createPcmChunk(0.0005, 4, frameSamples));
    expect(end).toHaveBeenCalledTimes(1);
    expect(detector.isSpeaking()).toBe(false);
  });
});
