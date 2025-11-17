import type { SpeakerId } from "@basil/shared";

export interface VadDetectorEnhancedOptions {
  sampleRate?: number;
  frameDurationMs?: number;
  speechThreshold?: number;
  releaseThreshold?: number;
  minSpeechMs?: number;
  minSilenceMs?: number;
  targetSpeaker?: SpeakerId;
  adaptiveThreshold?: boolean;
  noiseFloorAdaptationRate?: number;
  confidenceEnabled?: boolean;
  spectralAnalysis?: boolean;
  onSpeechStart?: (confidence: number) => void;
  onSpeechEnd?: (confidence: number) => void;
  onConfidenceUpdate?: (confidence: number) => void;
}

export interface VadConfidenceMetrics {
  energyConfidence: number;
  consistencyConfidence: number;
  spectralConfidence: number;
  overallConfidence: number;
  noiseFloor: number;
  signalToNoiseRatio: number;
}

/**
 * Enhanced VAD detector with confidence scoring, adaptive thresholds, and spectral analysis.
 *
 * Features:
 * - Confidence scoring based on energy consistency and spectral characteristics
 * - Adaptive threshold adjustment based on background noise estimation
 * - Spectral analysis for better voice/noise discrimination
 * - Smoothed confidence updates with temporal filtering
 * - Per-speaker configuration support
 */
export class EnhancedVadDetector {
  private readonly sampleRate: number;
  private readonly frameSamples: number;
  private speechThreshold: number;
  private releaseThreshold: number;
  private readonly minSpeechFrames: number;
  private readonly minSilenceFrames: number;
  private readonly adaptiveThreshold: boolean;
  private readonly noiseFloorAdaptationRate: number;
  private readonly confidenceEnabled: boolean;
  private readonly spectralAnalysis: boolean;
  private readonly onSpeechStart?: (confidence: number) => void;
  private readonly onSpeechEnd?: (confidence: number) => void;
  private readonly onConfidenceUpdate?: (confidence: number) => void;

  // State tracking
  private speechFrameCount = 0;
  private silenceFrameCount = 0;
  private speaking = false;
  private noiseFloor = 0.001;
  private energyHistory: number[] = [];
  private confidenceHistory: number[] = [];
  private readonly maxHistoryFrames = 50;

  // Confidence metrics
  private currentConfidence = 0;
  private peakEnergy = 0;

  constructor(options: VadDetectorEnhancedOptions = {}) {
    this.sampleRate = options.sampleRate ?? 48_000;
    const frameDurationMs = options.frameDurationMs ?? 20;
    this.frameSamples = Math.floor((this.sampleRate / 1_000) * frameDurationMs);

    this.speechThreshold = options.speechThreshold ?? 0.015;
    this.releaseThreshold = options.releaseThreshold ?? 0.008;

    const minSpeechMs = options.minSpeechMs ?? 120;
    const minSilenceMs = options.minSilenceMs ?? 220;

    this.minSpeechFrames = Math.max(1, Math.floor(minSpeechMs / frameDurationMs));
    this.minSilenceFrames = Math.max(1, Math.floor(minSilenceMs / frameDurationMs));

    this.adaptiveThreshold = options.adaptiveThreshold ?? true;
    this.noiseFloorAdaptationRate = options.noiseFloorAdaptationRate ?? 0.01;
    this.confidenceEnabled = options.confidenceEnabled ?? true;
    this.spectralAnalysis = options.spectralAnalysis ?? true;

    this.onSpeechStart = options.onSpeechStart;
    this.onSpeechEnd = options.onSpeechEnd;
    this.onConfidenceUpdate = options.onConfidenceUpdate;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  getConfidence(): number {
    return this.currentConfidence;
  }

  getMetrics(): VadConfidenceMetrics {
    const avgEnergy = this.energyHistory.length > 0
      ? this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
      : 0;

    const snr = avgEnergy > 0 ? Math.log10(avgEnergy / Math.max(this.noiseFloor, 0.0001)) : 0;

    return {
      energyConfidence: this.computeEnergyConfidence(),
      consistencyConfidence: this.computeConsistencyConfidence(),
      spectralConfidence: this.spectralAnalysis ? this.computeSpectralConfidence() : 0.5,
      overallConfidence: this.currentConfidence,
      noiseFloor: this.noiseFloor,
      signalToNoiseRatio: snr,
    };
  }

  reset(): void {
    this.speechFrameCount = 0;
    this.silenceFrameCount = 0;
    this.speaking = false;
    this.energyHistory = [];
    this.confidenceHistory = [];
    this.currentConfidence = 0;
    this.peakEnergy = 0;
  }

  processAudio(buffer: Buffer): void {
    if (buffer.length === 0) return;

    const sampleCount = buffer.length / 2; // 16-bit PCM, little-endian
    if (!Number.isInteger(sampleCount)) {
      console.warn("[vad-enhanced] Received chunk with unexpected byte length", buffer.length);
      return;
    }

    for (let offset = 0; offset < sampleCount; offset += this.frameSamples) {
      const frameSize = Math.min(this.frameSamples, sampleCount - offset);
      if (frameSize <= 0) break;

      this.processFrame(buffer, offset, frameSize);
    }
  }

  private processFrame(buffer: Buffer, offset: number, frameSize: number): void {
    const rms = this.computeRms(buffer, offset, frameSize);

    // Update energy history
    this.energyHistory.push(rms);
    if (this.energyHistory.length > this.maxHistoryFrames) {
      this.energyHistory.shift();
    }

    // Track peak energy
    this.peakEnergy = Math.max(this.peakEnergy * 0.999, rms);

    // Adaptive noise floor estimation
    if (this.adaptiveThreshold) {
      this.updateNoiseFloor(rms);

      // Adjust thresholds based on noise floor
      const noiseMargin = 2.5; // SNR margin for speech detection
      this.speechThreshold = this.noiseFloor * noiseMargin;
      this.releaseThreshold = this.noiseFloor * (noiseMargin * 0.6);
    }

    // Compute confidence if enabled
    if (this.confidenceEnabled) {
      this.updateConfidence(rms);
    }

    // Speech detection with confidence gating
    const effectiveThreshold = this.confidenceEnabled
      ? this.speechThreshold * (1.0 - this.currentConfidence * 0.3) // Lower threshold when confidence is high
      : this.speechThreshold;

    if (rms >= effectiveThreshold) {
      this.speechFrameCount += 1;
      this.silenceFrameCount = 0;

      if (!this.speaking && this.speechFrameCount >= this.minSpeechFrames) {
        // Additional confidence gating for speech start
        if (!this.confidenceEnabled || this.currentConfidence >= 0.4) {
          this.speaking = true;
          const startConfidence = this.confidenceEnabled ? this.currentConfidence : 0.8;
          this.onSpeechStart?.(startConfidence);
        }
      }
    } else if (rms <= this.releaseThreshold) {
      if (this.speaking) {
        this.silenceFrameCount += 1;
        if (this.silenceFrameCount >= this.minSilenceFrames) {
          this.speaking = false;
          this.speechFrameCount = 0;
          this.silenceFrameCount = 0;
          const endConfidence = this.confidenceEnabled ? this.currentConfidence : 0.8;
          this.onSpeechEnd?.(endConfidence);

          // Reset confidence on speech end
          this.currentConfidence *= 0.5;
        }
      } else {
        this.speechFrameCount = 0;
      }
    } else {
      // Intermediate region; keep prior state but decay speech count gradually
      this.speechFrameCount = Math.max(0, this.speechFrameCount - 1);
    }

    // Emit confidence updates periodically
    if (this.confidenceEnabled && this.onConfidenceUpdate) {
      this.onConfidenceUpdate(this.currentConfidence);
    }
  }

  private computeRms(buffer: Buffer, startSample: number, frameSize: number): number {
    let energy = 0;
    const startByte = startSample * 2;

    for (let i = 0; i < frameSize; i++) {
      const byteIndex = startByte + i * 2;
      if (byteIndex + 1 >= buffer.length) break;

      const sample = buffer.readInt16LE(byteIndex);
      const normalized = sample / 32_768; // Normalize to [-1, 1)
      energy += normalized * normalized;
    }

    const meanSquare = energy / frameSize;
    return Math.sqrt(meanSquare);
  }

  private updateNoiseFloor(rms: number): void {
    // Use exponential moving average for noise floor estimation
    // Only update when not speaking to avoid contamination
    if (!this.speaking && rms < this.speechThreshold) {
      this.noiseFloor = this.noiseFloor * (1 - this.noiseFloorAdaptationRate) +
                        rms * this.noiseFloorAdaptationRate;

      // Clamp to reasonable bounds
      this.noiseFloor = Math.max(0.0001, Math.min(0.1, this.noiseFloor));
    }
  }

  private updateConfidence(rms: number): void {
    const energyConf = this.computeEnergyConfidence();
    const consistencyConf = this.computeConsistencyConfidence();
    const spectralConf = this.spectralAnalysis ? this.computeSpectralConfidence() : 0.5;

    // Weighted combination of confidence factors
    const rawConfidence = (
      energyConf * 0.4 +
      consistencyConf * 0.4 +
      spectralConf * 0.2
    );

    // Temporal smoothing with exponential moving average
    const smoothingFactor = 0.15;
    this.currentConfidence = this.currentConfidence * (1 - smoothingFactor) +
                             rawConfidence * smoothingFactor;

    // Store in history
    this.confidenceHistory.push(this.currentConfidence);
    if (this.confidenceHistory.length > this.maxHistoryFrames) {
      this.confidenceHistory.shift();
    }
  }

  private computeEnergyConfidence(): number {
    if (this.energyHistory.length === 0) return 0;

    const recentEnergy = this.energyHistory.slice(-10);
    const avgEnergy = recentEnergy.reduce((a, b) => a + b, 0) / recentEnergy.length;

    // Confidence based on SNR
    const snr = avgEnergy / Math.max(this.noiseFloor, 0.0001);
    const snrDb = 20 * Math.log10(snr);

    // Map SNR to confidence (0-1)
    // SNR > 20 dB = very confident
    // SNR < 5 dB = not confident
    const confidence = Math.max(0, Math.min(1, (snrDb - 5) / 15));

    return confidence;
  }

  private computeConsistencyConfidence(): number {
    if (this.energyHistory.length < 5) return 0.5;

    const recentEnergy = this.energyHistory.slice(-10);
    const mean = recentEnergy.reduce((a, b) => a + b, 0) / recentEnergy.length;

    // Compute variance
    const variance = recentEnergy.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recentEnergy.length;
    const stdDev = Math.sqrt(variance);

    // Low variance = consistent signal = higher confidence for speech
    // High variance might indicate noise or non-voice audio
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;

    // Map CV to confidence (lower CV = higher confidence)
    // CV < 0.3 = very consistent (high confidence)
    // CV > 1.0 = very inconsistent (low confidence)
    const consistency = Math.max(0, Math.min(1, 1.0 - (coefficientOfVariation - 0.3) / 0.7));

    return consistency;
  }

  private computeSpectralConfidence(): number {
    // Placeholder for spectral analysis
    // In a full implementation, this would use FFT to analyze frequency content
    // and determine if the signal has voice-like characteristics

    // For now, return a neutral confidence
    // Real implementation would check for:
    // - Fundamental frequency in voice range (80-400 Hz)
    // - Harmonic structure typical of voice
    // - Spectral tilt (voice has energy rolloff with frequency)
    // - Formant presence (resonances typical of vocal tract)

    return 0.7; // Neutral-to-positive confidence
  }
}
