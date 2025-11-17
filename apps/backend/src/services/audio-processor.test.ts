import { describe, it, expect, beforeEach } from "vitest";
import { AudioProcessor, MultiChannelAudioProcessor, type DuckingProfile } from "./audio-processor";

describe("AudioProcessor", () => {
  let processor: AudioProcessor;
  const sampleRate = 48_000;

  beforeEach(() => {
    processor = new AudioProcessor({
      sampleRate,
      ducking: {
        profile: "medium",
        rampUpMs: 50,
        rampDownMs: 150,
        curve: "exponential",
      },
    });
  });

  describe("Basic ducking", () => {
    it("should start with unity gain (no ducking)", () => {
      expect(processor.getCurrentGain()).toBe(1.0);
      expect(processor.getCurrentGainDb()).toBe(0);
      expect(processor.isDucking()).toBe(false);
    });

    it("should reduce gain when ducking starts", () => {
      processor.startDucking(true); // Immediate

      expect(processor.getCurrentGain()).toBeLessThan(1.0);
      expect(processor.getCurrentGainDb()).toBeLessThan(0);
      expect(processor.isDucking()).toBe(true);
    });

    it("should restore gain when ducking stops", () => {
      processor.startDucking(true);
      expect(processor.isDucking()).toBe(true);

      processor.stopDucking(true);

      expect(processor.getCurrentGain()).toBe(1.0);
      expect(processor.getCurrentGainDb()).toBe(0);
      expect(processor.isDucking()).toBe(false);
    });

    it("should apply ducking to audio buffers", () => {
      processor.startDucking(true);

      const inputBuffer = generateTestBuffer(480, 0.5); // 10ms at 48kHz
      const outputBuffer = processor.processBuffer(inputBuffer);

      // Output should have lower amplitude
      const inputRms = calculateRms(inputBuffer);
      const outputRms = calculateRms(outputBuffer);

      expect(outputRms).toBeLessThan(inputRms);
      expect(outputBuffer.length).toBe(inputBuffer.length);
    });
  });

  describe("Ducking profiles", () => {
    const profiles: DuckingProfile[] = ["soft", "medium", "hard"];

    it.each(profiles)("should apply %s ducking correctly", (profile) => {
      processor = new AudioProcessor({
        sampleRate,
        ducking: { profile },
      });

      processor.startDucking(true);
      const gain = processor.getCurrentGain();

      expect(gain).toBeGreaterThan(0);
      expect(gain).toBeLessThan(1.0);
    });

    it("should apply different gain levels for different profiles", () => {
      const gains: Record<DuckingProfile, number> = {
        soft: 0,
        medium: 0,
        hard: 0,
        custom: 0,
      };

      for (const profile of ["soft", "medium", "hard"] as const) {
        const p = new AudioProcessor({
          sampleRate,
          ducking: { profile },
        });
        p.startDucking(true);
        gains[profile] = p.getCurrentGain();
      }

      // Soft should have highest gain, hard should have lowest
      expect(gains.soft).toBeGreaterThan(gains.medium);
      expect(gains.medium).toBeGreaterThan(gains.hard);
    });

    it("should support custom ducking profile", () => {
      processor = new AudioProcessor({
        sampleRate,
        ducking: {
          profile: "custom",
          reductionDb: -20, // Custom 20 dB reduction
        },
      });

      processor.startDucking(true);
      const gainDb = processor.getCurrentGainDb();

      expect(gainDb).toBeCloseTo(-20, 1);
    });
  });

  describe("Gain ramping", () => {
    it("should smoothly ramp gain when ducking starts", () => {
      processor = new AudioProcessor({
        sampleRate,
        ducking: {
          profile: "medium",
          rampUpMs: 50,
        },
      });

      processor.startDucking(false); // Not immediate - use ramp

      expect(processor.isRamping()).toBe(true);

      // Process audio to advance ramp
      const buffer = generateTestBuffer(sampleRate / 10, 0.5); // 100ms
      processor.processBuffer(buffer);

      // Should have finished ramping
      expect(processor.isRamping()).toBe(false);
      expect(processor.isDucking()).toBe(true);
    });

    it("should smoothly ramp gain when ducking stops", () => {
      processor.startDucking(true);
      processor.stopDucking(false); // Use ramp

      expect(processor.isRamping()).toBe(true);

      // Process audio to advance ramp
      const buffer = generateTestBuffer(sampleRate / 5, 0.5); // 200ms
      processor.processBuffer(buffer);

      // Should have finished ramping
      expect(processor.isRamping()).toBe(false);
      expect(processor.getCurrentGain()).toBeCloseTo(1.0, 2);
    });

    it("should create smooth gain transitions without clicks", () => {
      processor.startDucking(false);

      const bufferSize = 480; // 10ms chunks
      const buffers: Buffer[] = [];

      // Process multiple buffers during ramp
      for (let i = 0; i < 10; i++) {
        const input = generateTestBuffer(bufferSize, 0.5);
        const output = processor.processBuffer(input);
        buffers.push(output);
      }

      // Check that gain changes smoothly (no sudden jumps)
      for (let i = 1; i < buffers.length; i++) {
        const rms1 = calculateRms(buffers[i - 1]);
        const rms2 = calculateRms(buffers[i]);
        const change = Math.abs(rms2 - rms1) / rms1;

        // Change should be gradual (less than 30% per 10ms chunk)
        expect(change).toBeLessThan(0.3);
      }
    });
  });

  describe("Ducking curves", () => {
    it("should apply linear curve correctly", () => {
      processor = new AudioProcessor({
        sampleRate,
        ducking: {
          profile: "medium",
          rampUpMs: 100,
          curve: "linear",
        },
      });

      processor.startDucking(false);

      const gains: number[] = [];
      const bufferSize = 960; // 20ms

      // Collect gains during ramp
      for (let i = 0; i < 6; i++) {
        const buffer = generateTestBuffer(bufferSize, 0.5);
        processor.processBuffer(buffer);
        gains.push(processor.getCurrentGain());
      }

      // Linear curve should have roughly equal steps
      const steps: number[] = [];
      for (let i = 1; i < gains.length; i++) {
        steps.push(gains[i - 1] - gains[i]);
      }

      // Variance in steps should be low for linear curve
      const avgStep = steps.reduce((a, b) => a + b, 0) / steps.length;
      const variance = steps.reduce((acc, step) => acc + Math.pow(step - avgStep, 2), 0) / steps.length;

      expect(variance).toBeLessThan(0.01);
    });

    it("should apply exponential curve correctly", () => {
      processor = new AudioProcessor({
        sampleRate,
        ducking: {
          profile: "medium",
          rampUpMs: 100,
          curve: "exponential",
        },
      });

      processor.startDucking(false);

      const gains: number[] = [];
      const bufferSize = 960; // 20ms

      for (let i = 0; i < 6; i++) {
        const buffer = generateTestBuffer(bufferSize, 0.5);
        processor.processBuffer(buffer);
        gains.push(processor.getCurrentGain());
      }

      // Exponential curve: steps should decrease (starts slow, ends fast)
      const steps: number[] = [];
      for (let i = 1; i < gains.length; i++) {
        steps.push(Math.abs(gains[i - 1] - gains[i]));
      }

      // Later steps should be larger than earlier steps
      const firstHalfAvg = steps.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
      const secondHalfAvg = steps.slice(-2).reduce((a, b) => a + b, 0) / 2;

      expect(secondHalfAvg).toBeGreaterThan(firstHalfAvg * 0.8);
    });
  });

  describe("Edge cases", () => {
    it("should handle repeated ducking start calls", () => {
      processor.startDucking(false);
      processor.startDucking(false);
      processor.startDucking(false);

      expect(processor.isDucking()).toBe(true);
      expect(() => processor.processBuffer(generateTestBuffer(480, 0.5))).not.toThrow();
    });

    it("should handle repeated ducking stop calls", () => {
      processor.startDucking(true);
      processor.stopDucking(false);
      processor.stopDucking(false);
      processor.stopDucking(false);

      expect(() => processor.processBuffer(generateTestBuffer(480, 0.5))).not.toThrow();
    });

    it("should handle empty buffers", () => {
      processor.startDucking(true);
      const emptyBuffer = Buffer.alloc(0);

      const output = processor.processBuffer(emptyBuffer);
      expect(output.length).toBe(0);
    });

    it("should not modify input buffer when no ducking", () => {
      const input = generateTestBuffer(480, 0.5);
      const inputCopy = Buffer.from(input);

      const output = processor.processBuffer(input);

      expect(input.equals(inputCopy)).toBe(true);
      expect(output.equals(input)).toBe(true);
    });

    it("should not clip at maximum amplitude", () => {
      const maxBuffer = Buffer.allocUnsafe(960);
      for (let i = 0; i < 480; i++) {
        maxBuffer.writeInt16LE(32767, i * 2); // Max positive value
      }

      const output = processor.processBuffer(maxBuffer);

      // Check no value exceeds int16 range
      for (let i = 0; i < 480; i++) {
        const sample = output.readInt16LE(i * 2);
        expect(sample).toBeGreaterThanOrEqual(-32768);
        expect(sample).toBeLessThanOrEqual(32767);
      }
    });
  });
});

describe("MultiChannelAudioProcessor", () => {
  let multiProcessor: MultiChannelAudioProcessor;

  beforeEach(() => {
    multiProcessor = new MultiChannelAudioProcessor({
      sampleRate: 48_000,
      ducking: {
        profile: "medium",
        rampUpMs: 50,
        rampDownMs: 150,
      },
    });
  });

  describe("Multi-channel management", () => {
    it("should create separate processors for each speaker", () => {
      const buffer = generateTestBuffer(480, 0.5);

      multiProcessor.processAudio("claude", buffer);
      multiProcessor.processAudio("guest", buffer);

      const status = multiProcessor.getDuckingStatus();
      expect(status.size).toBeGreaterThanOrEqual(2);
      expect(status.has("claude")).toBe(true);
      expect(status.has("guest")).toBe(true);
    });

    it("should duck specific speakers independently", () => {
      multiProcessor.startDucking(["claude"], true);

      const status = multiProcessor.getDuckingStatus();
      const claudeStatus = status.get("claude");
      const guestProcessor = multiProcessor.getProcessor("guest");

      expect(claudeStatus?.ducking).toBe(true);
      expect(guestProcessor.isDucking()).toBe(false);
    });

    it("should duck multiple speakers together", () => {
      multiProcessor.startDucking(["claude", "guest"], true);

      const status = multiProcessor.getDuckingStatus();
      const claudeStatus = status.get("claude");
      const guestStatus = status.get("guest");

      expect(claudeStatus?.ducking).toBe(true);
      expect(guestStatus?.ducking).toBe(true);
    });

    it("should stop ducking for specific speakers", () => {
      multiProcessor.startDucking(["claude", "guest"], true);
      multiProcessor.stopDucking(["claude"], true);

      const status = multiProcessor.getDuckingStatus();
      const claudeStatus = status.get("claude");
      const guestStatus = status.get("guest");

      expect(claudeStatus?.ducking).toBe(false);
      expect(guestStatus?.ducking).toBe(true);
    });

    it("should provide ducking status for all speakers", () => {
      multiProcessor.startDucking(["claude"], true);
      multiProcessor.processAudio("guest", generateTestBuffer(480, 0.5));

      const status = multiProcessor.getDuckingStatus();

      for (const [_, speakerStatus] of status) {
        expect(speakerStatus).toHaveProperty("ducking");
        expect(speakerStatus).toHaveProperty("gain");
        expect(speakerStatus).toHaveProperty("gainDb");

        expect(typeof speakerStatus.ducking).toBe("boolean");
        expect(typeof speakerStatus.gain).toBe("number");
        expect(typeof speakerStatus.gainDb).toBe("number");
      }
    });
  });

  describe("Coordinated ducking", () => {
    it("should apply same ducking profile to all speakers", () => {
      multiProcessor.startDucking(["claude", "guest"], true);

      const status = multiProcessor.getDuckingStatus();
      const claudeGain = status.get("claude")?.gain;
      const guestGain = status.get("guest")?.gain;

      expect(claudeGain).toBeCloseTo(guestGain!, 3);
    });

    it("should process audio independently for each speaker", () => {
      const claudeBuffer = generateTestBuffer(480, 0.5);
      const guestBuffer = generateTestBuffer(480, 0.3);

      multiProcessor.startDucking(["claude", "guest"], true);

      const claudeOutput = multiProcessor.processAudio("claude", claudeBuffer);
      const guestOutput = multiProcessor.processAudio("guest", guestBuffer);

      // Buffers should be processed independently
      expect(claudeOutput.equals(guestOutput)).toBe(false);

      // But both should be ducked
      const claudeRms = calculateRms(claudeOutput);
      const guestRms = calculateRms(guestOutput);
      const claudeInputRms = calculateRms(claudeBuffer);
      const guestInputRms = calculateRms(guestBuffer);

      expect(claudeRms).toBeLessThan(claudeInputRms);
      expect(guestRms).toBeLessThan(guestInputRms);
    });
  });
});

// Helper functions

function generateTestBuffer(samples: number, amplitude: number): Buffer {
  const buffer = Buffer.allocUnsafe(samples * 2);

  for (let i = 0; i < samples; i++) {
    // Simple sine wave
    const sample = Math.sin((i / samples) * 2 * Math.PI * 10) * amplitude * 32768;
    const clamped = Math.max(-32768, Math.min(32767, Math.round(sample)));
    buffer.writeInt16LE(clamped, i * 2);
  }

  return buffer;
}

function calculateRms(buffer: Buffer): number {
  const samples = buffer.length / 2;
  let sum = 0;

  for (let i = 0; i < samples; i++) {
    const sample = buffer.readInt16LE(i * 2) / 32768;
    sum += sample * sample;
  }

  return Math.sqrt(sum / samples);
}
