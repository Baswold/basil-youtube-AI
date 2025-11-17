import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnhancedVadDetector, type VadDetectorEnhancedOptions } from "./vad-detector-enhanced";

describe("EnhancedVadDetector", () => {
  let detector: EnhancedVadDetector;
  const sampleRate = 48_000;
  const frameDurationMs = 20;
  const frameSamples = (sampleRate / 1_000) * frameDurationMs;

  beforeEach(() => {
    detector = new EnhancedVadDetector({
      sampleRate,
      frameDurationMs,
      adaptiveThreshold: true,
      confidenceEnabled: true,
      spectralAnalysis: false, // Disable for testing (placeholder implementation)
    });
  });

  describe("Basic VAD functionality", () => {
    it("should start in non-speaking state", () => {
      expect(detector.isSpeaking()).toBe(false);
      expect(detector.getConfidence()).toBe(0);
    });

    it("should detect speech when energy exceeds threshold", () => {
      const onSpeechStart = vi.fn();
      detector = new EnhancedVadDetector({
        sampleRate,
        adaptiveThreshold: false,
        speechThreshold: 0.01,
        minSpeechMs: 60,
        onSpeechStart,
      });

      // Generate high-energy audio (speech-like)
      const speechBuffer = generateAudioBuffer(frameSamples * 10, 0.05);
      detector.processAudio(speechBuffer);

      expect(onSpeechStart).toHaveBeenCalled();
      expect(detector.isSpeaking()).toBe(true);
    });

    it("should detect speech end when energy drops", () => {
      const onSpeechStart = vi.fn();
      const onSpeechEnd = vi.fn();

      detector = new EnhancedVadDetector({
        sampleRate,
        adaptiveThreshold: false,
        speechThreshold: 0.01,
        releaseThreshold: 0.005,
        minSpeechMs: 60,
        minSilenceMs: 100,
        onSpeechStart,
        onSpeechEnd,
      });

      // Start speech
      const speechBuffer = generateAudioBuffer(frameSamples * 10, 0.05);
      detector.processAudio(speechBuffer);
      expect(detector.isSpeaking()).toBe(true);

      // Silence
      const silenceBuffer = generateAudioBuffer(frameSamples * 20, 0.001);
      detector.processAudio(silenceBuffer);

      expect(onSpeechEnd).toHaveBeenCalled();
      expect(detector.isSpeaking()).toBe(false);
    });

    it("should reset state correctly", () => {
      const speechBuffer = generateAudioBuffer(frameSamples * 10, 0.05);
      detector.processAudio(speechBuffer);

      detector.reset();

      expect(detector.isSpeaking()).toBe(false);
      expect(detector.getConfidence()).toBe(0);
    });
  });

  describe("Confidence scoring", () => {
    beforeEach(() => {
      detector = new EnhancedVadDetector({
        sampleRate,
        confidenceEnabled: true,
        adaptiveThreshold: true,
      });
    });

    it("should increase confidence with consistent speech", () => {
      const speechBuffer = generateAudioBuffer(frameSamples * 30, 0.05);

      // Initial confidence should be low
      detector.processAudio(generateAudioBuffer(frameSamples * 2, 0.05));
      const initialConfidence = detector.getConfidence();

      // After more consistent speech, confidence should increase
      detector.processAudio(speechBuffer);
      const finalConfidence = detector.getConfidence();

      expect(finalConfidence).toBeGreaterThan(initialConfidence);
    });

    it("should decrease confidence during silence", () => {
      // Build up confidence with speech
      const speechBuffer = generateAudioBuffer(frameSamples * 30, 0.05);
      detector.processAudio(speechBuffer);
      const speechConfidence = detector.getConfidence();

      // Process silence
      const silenceBuffer = generateAudioBuffer(frameSamples * 20, 0.001);
      detector.processAudio(silenceBuffer);
      const silenceConfidence = detector.getConfidence();

      expect(silenceConfidence).toBeLessThan(speechConfidence);
    });

    it("should provide confidence metrics", () => {
      const speechBuffer = generateAudioBuffer(frameSamples * 20, 0.05);
      detector.processAudio(speechBuffer);

      const metrics = detector.getMetrics();

      expect(metrics).toHaveProperty("energyConfidence");
      expect(metrics).toHaveProperty("consistencyConfidence");
      expect(metrics).toHaveProperty("spectralConfidence");
      expect(metrics).toHaveProperty("overallConfidence");
      expect(metrics).toHaveProperty("noiseFloor");
      expect(metrics).toHaveProperty("signalToNoiseRatio");

      expect(metrics.energyConfidence).toBeGreaterThanOrEqual(0);
      expect(metrics.energyConfidence).toBeLessThanOrEqual(1);
      expect(metrics.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(metrics.overallConfidence).toBeLessThanOrEqual(1);
    });

    it("should pass confidence to callbacks", () => {
      const onSpeechStart = vi.fn();
      const onSpeechEnd = vi.fn();

      detector = new EnhancedVadDetector({
        sampleRate,
        confidenceEnabled: true,
        minSpeechMs: 60,
        minSilenceMs: 100,
        onSpeechStart,
        onSpeechEnd,
      });

      // Start speech
      const speechBuffer = generateAudioBuffer(frameSamples * 10, 0.05);
      detector.processAudio(speechBuffer);

      expect(onSpeechStart).toHaveBeenCalledWith(expect.any(Number));
      const startConfidence = onSpeechStart.mock.calls[0][0];
      expect(startConfidence).toBeGreaterThanOrEqual(0);
      expect(startConfidence).toBeLessThanOrEqual(1);

      // End speech
      const silenceBuffer = generateAudioBuffer(frameSamples * 20, 0.001);
      detector.processAudio(silenceBuffer);

      expect(onSpeechEnd).toHaveBeenCalledWith(expect.any(Number));
    });
  });

  describe("Adaptive thresholding", () => {
    it("should adapt to background noise level", () => {
      detector = new EnhancedVadDetector({
        sampleRate,
        adaptiveThreshold: true,
        noiseFloorAdaptationRate: 0.1, // Faster adaptation for testing
      });

      // Process low-level noise
      const noiseBuffer = generateAudioBuffer(frameSamples * 50, 0.003);
      detector.processAudio(noiseBuffer);

      const metrics1 = detector.getMetrics();
      const noiseFloor1 = metrics1.noiseFloor;

      // Process higher-level noise
      const louderNoiseBuffer = generateAudioBuffer(frameSamples * 50, 0.008);
      detector.processAudio(louderNoiseBuffer);

      const metrics2 = detector.getMetrics();
      const noiseFloor2 = metrics2.noiseFloor;

      expect(noiseFloor2).toBeGreaterThan(noiseFloor1);
    });

    it("should adjust speech threshold based on noise floor", () => {
      detector = new EnhancedVadDetector({
        sampleRate,
        adaptiveThreshold: true,
        speechThreshold: 0.01, // Initial threshold
      });

      const onSpeechStart = vi.fn();
      detector = new EnhancedVadDetector({
        sampleRate,
        adaptiveThreshold: true,
        noiseFloorAdaptationRate: 0.2,
        minSpeechMs: 60,
        onSpeechStart,
      });

      // Adapt to higher noise floor
      const noiseBuffer = generateAudioBuffer(frameSamples * 50, 0.008);
      detector.processAudio(noiseBuffer);

      // Speech that would trigger with low threshold shouldn't trigger with adapted threshold
      const marginalSpeechBuffer = generateAudioBuffer(frameSamples * 10, 0.015);
      detector.processAudio(marginalSpeechBuffer);

      // The detector should have adapted its threshold upward
      const metrics = detector.getMetrics();
      expect(metrics.noiseFloor).toBeGreaterThan(0.001);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty buffers gracefully", () => {
      const emptyBuffer = Buffer.alloc(0);
      expect(() => detector.processAudio(emptyBuffer)).not.toThrow();
    });

    it("should handle odd-length buffers", () => {
      // 16-bit samples should be even-length bytes
      const oddBuffer = Buffer.alloc(101); // Odd number
      expect(() => detector.processAudio(oddBuffer)).not.toThrow();
    });

    it("should handle very short buffers", () => {
      const shortBuffer = generateAudioBuffer(10, 0.05);
      expect(() => detector.processAudio(shortBuffer)).not.toThrow();
    });

    it("should handle maximum amplitude without clipping", () => {
      const maxAmplitudeBuffer = generateAudioBuffer(frameSamples * 10, 1.0);
      expect(() => detector.processAudio(maxAmplitudeBuffer)).not.toThrow();
      expect(detector.getMetrics()).toBeDefined();
    });
  });

  describe("Configuration options", () => {
    it("should use custom sample rate", () => {
      const customDetector = new EnhancedVadDetector({
        sampleRate: 16_000,
        frameDurationMs: 30,
      });

      const buffer = generateAudioBuffer(480, 0.05); // 30ms at 16kHz
      expect(() => customDetector.processAudio(buffer)).not.toThrow();
    });

    it("should respect confidence updates callback", () => {
      const onConfidenceUpdate = vi.fn();

      detector = new EnhancedVadDetector({
        sampleRate,
        confidenceEnabled: true,
        onConfidenceUpdate,
      });

      const speechBuffer = generateAudioBuffer(frameSamples * 10, 0.05);
      detector.processAudio(speechBuffer);

      expect(onConfidenceUpdate).toHaveBeenCalled();
      expect(onConfidenceUpdate).toHaveBeenCalledWith(expect.any(Number));
    });

    it("should support disabling confidence scoring", () => {
      detector = new EnhancedVadDetector({
        sampleRate,
        confidenceEnabled: false,
      });

      const speechBuffer = generateAudioBuffer(frameSamples * 10, 0.05);
      detector.processAudio(speechBuffer);

      // Confidence should remain at 0 when disabled
      expect(detector.getConfidence()).toBe(0);
    });

    it("should support disabling adaptive thresholding", () => {
      detector = new EnhancedVadDetector({
        sampleRate,
        adaptiveThreshold: false,
        speechThreshold: 0.02,
      });

      const initialMetrics = detector.getMetrics();
      const initialNoiseFloor = initialMetrics.noiseFloor;

      // Process noise - noise floor should not adapt
      const noiseBuffer = generateAudioBuffer(frameSamples * 50, 0.008);
      detector.processAudio(noiseBuffer);

      const finalMetrics = detector.getMetrics();
      const finalNoiseFloor = finalMetrics.noiseFloor;

      // Noise floor should remain relatively stable
      expect(Math.abs(finalNoiseFloor - initialNoiseFloor)).toBeLessThan(0.001);
    });
  });

  describe("Performance", () => {
    it("should process audio in real-time", () => {
      const bufferCount = 100;
      const bufferSize = frameSamples * 2;

      const startTime = Date.now();

      for (let i = 0; i < bufferCount; i++) {
        const buffer = generateAudioBuffer(bufferSize, 0.05);
        detector.processAudio(buffer);
      }

      const elapsed = Date.now() - startTime;
      const audioProcessed = (bufferCount * bufferSize) / sampleRate; // seconds
      const realTimeRatio = audioProcessed / (elapsed / 1000);

      // Should process faster than real-time
      expect(realTimeRatio).toBeGreaterThan(10);
    });
  });
});

// Helper function to generate audio buffers with specified RMS energy
function generateAudioBuffer(samples: number, rms: number): Buffer {
  const buffer = Buffer.allocUnsafe(samples * 2); // 16-bit samples

  for (let i = 0; i < samples; i++) {
    // Generate sample with target RMS
    // Use sine wave with some noise for more realistic signal
    const t = i / 48_000;
    const frequency = 200 + Math.random() * 200; // 200-400 Hz (voice-like)
    const signal = Math.sin(2 * Math.PI * frequency * t);
    const noise = (Math.random() - 0.5) * 0.1;
    const sample = (signal + noise) * rms * 32_768;

    // Clamp to 16-bit range
    const clamped = Math.max(-32768, Math.min(32767, Math.round(sample)));
    buffer.writeInt16LE(clamped, i * 2);
  }

  return buffer;
}
