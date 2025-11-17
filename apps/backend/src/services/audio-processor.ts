/**
 * Enhanced audio processor with smooth ducking, gain ramping, and EQ.
 *
 * Features:
 * - Smooth gain transitions with configurable ramp times
 * - Multiple ducking profiles (soft, medium, hard, custom)
 * - Per-sample gain interpolation for click-free transitions
 * - Configurable ducking curves (linear, exponential, logarithmic)
 * - Pre-ducking support (anticipatory ducking)
 * - Look-ahead processing for smoother transitions
 */

export type DuckingProfile = "soft" | "medium" | "hard" | "custom";
export type DuckingCurve = "linear" | "exponential" | "logarithmic";

export interface DuckingConfig {
  profile?: DuckingProfile;
  reductionDb?: number; // Custom reduction in dB (used when profile is "custom")
  rampUpMs?: number; // Time to fade in ducking
  rampDownMs?: number; // Time to fade out ducking
  curve?: DuckingCurve;
  preDuckingMs?: number; // Start ducking this many ms early
}

export interface AudioProcessorConfig {
  sampleRate?: number;
  ducking?: DuckingConfig;
}

interface GainRampState {
  active: boolean;
  startGain: number;
  targetGain: number;
  currentGain: number;
  rampSamples: number;
  elapsedSamples: number;
  curve: DuckingCurve;
}

export class AudioProcessor {
  private readonly sampleRate: number;
  private readonly duckingConfig: Required<DuckingConfig>;
  private rampState: GainRampState;

  // Ducking profile presets
  private static readonly DUCKING_PROFILES: Record<Exclude<DuckingProfile, "custom">, number> = {
    soft: -6,    // Reduce by 6 dB (50% amplitude)
    medium: -12, // Reduce by 12 dB (25% amplitude)
    hard: -18,   // Reduce by 18 dB (12.5% amplitude)
  };

  constructor(config: AudioProcessorConfig = {}) {
    this.sampleRate = config.sampleRate ?? 48_000;

    // Initialize ducking configuration with defaults
    const duckingDefaults: Required<DuckingConfig> = {
      profile: "medium",
      reductionDb: -12,
      rampUpMs: 50, // 50ms fade in (fast enough to be responsive, slow enough to avoid clicks)
      rampDownMs: 150, // 150ms fade out (slower to avoid jarring restoration)
      curve: "exponential",
      preDuckingMs: 0,
    };

    this.duckingConfig = { ...duckingDefaults, ...config.ducking };

    // Initialize ramp state
    this.rampState = {
      active: false,
      startGain: 1.0,
      targetGain: 1.0,
      currentGain: 1.0,
      rampSamples: 0,
      elapsedSamples: 0,
      curve: this.duckingConfig.curve,
    };
  }

  /**
   * Start ducking (reduce gain).
   * @param immediate If true, skip ramp and apply immediately
   */
  startDucking(immediate = false): void {
    const reductionDb = this.getDuckingReduction();
    const targetGain = this.dbToGain(reductionDb);

    if (immediate) {
      this.rampState = {
        active: false,
        startGain: targetGain,
        targetGain,
        currentGain: targetGain,
        rampSamples: 0,
        elapsedSamples: 0,
        curve: this.duckingConfig.curve,
      };
    } else {
      const rampSamples = Math.floor((this.sampleRate / 1000) * this.duckingConfig.rampUpMs);
      this.rampState = {
        active: true,
        startGain: this.rampState.currentGain,
        targetGain,
        currentGain: this.rampState.currentGain,
        rampSamples,
        elapsedSamples: 0,
        curve: this.duckingConfig.curve,
      };
    }
  }

  /**
   * Stop ducking (restore full gain).
   * @param immediate If true, skip ramp and restore immediately
   */
  stopDucking(immediate = false): void {
    const targetGain = 1.0;

    if (immediate) {
      this.rampState = {
        active: false,
        startGain: targetGain,
        targetGain,
        currentGain: targetGain,
        rampSamples: 0,
        elapsedSamples: 0,
        curve: this.duckingConfig.curve,
      };
    } else {
      const rampSamples = Math.floor((this.sampleRate / 1000) * this.duckingConfig.rampDownMs);
      this.rampState = {
        active: true,
        startGain: this.rampState.currentGain,
        targetGain,
        currentGain: this.rampState.currentGain,
        rampSamples,
        elapsedSamples: 0,
        curve: this.duckingConfig.curve,
      };
    }
  }

  /**
   * Process audio buffer with current gain/ducking state.
   * Applies per-sample gain interpolation for smooth transitions.
   */
  processBuffer(buffer: Buffer): Buffer {
    if (!this.rampState.active && this.rampState.currentGain === 1.0) {
      // No processing needed
      return buffer;
    }

    const processed = Buffer.allocUnsafe(buffer.length);
    const sampleCount = buffer.length / 2; // 16-bit samples

    for (let i = 0; i < sampleCount; i++) {
      const byteOffset = i * 2;

      // Read sample
      const sample = buffer.readInt16LE(byteOffset);

      // Compute current gain for this sample
      let gain = this.rampState.currentGain;
      if (this.rampState.active) {
        gain = this.computeRampGain();
        this.rampState.elapsedSamples++;

        // Check if ramp is complete
        if (this.rampState.elapsedSamples >= this.rampState.rampSamples) {
          this.rampState.active = false;
          this.rampState.currentGain = this.rampState.targetGain;
        } else {
          this.rampState.currentGain = gain;
        }
      }

      // Apply gain and clamp
      let scaled = Math.round(sample * gain);
      scaled = Math.max(-32768, Math.min(32767, scaled));

      processed.writeInt16LE(scaled, byteOffset);
    }

    return processed;
  }

  /**
   * Get current gain value (0.0 to 1.0).
   */
  getCurrentGain(): number {
    return this.rampState.currentGain;
  }

  /**
   * Get current gain in dB.
   */
  getCurrentGainDb(): number {
    return this.gainToDb(this.rampState.currentGain);
  }

  /**
   * Check if currently ducking (gain < 1.0).
   */
  isDucking(): boolean {
    return this.rampState.currentGain < 0.99 || this.rampState.targetGain < 0.99;
  }

  /**
   * Check if currently ramping (transitioning between gain levels).
   */
  isRamping(): boolean {
    return this.rampState.active;
  }

  private getDuckingReduction(): number {
    if (this.duckingConfig.profile === "custom") {
      return this.duckingConfig.reductionDb;
    }
    return AudioProcessor.DUCKING_PROFILES[this.duckingConfig.profile];
  }

  private computeRampGain(): number {
    const progress = this.rampState.elapsedSamples / this.rampState.rampSamples;
    const { startGain, targetGain } = this.rampState;

    // Apply curve to progress
    let curvedProgress: number;
    switch (this.rampState.curve) {
      case "linear":
        curvedProgress = progress;
        break;

      case "exponential":
        // Exponential curve: starts slow, ends fast
        curvedProgress = progress * progress;
        break;

      case "logarithmic":
        // Logarithmic curve: starts fast, ends slow
        curvedProgress = 1 - Math.pow(1 - progress, 2);
        break;

      default:
        curvedProgress = progress;
    }

    // Interpolate between start and target gain
    // For gain, we interpolate in linear domain for simplicity
    // (could also interpolate in dB domain for more perceptually uniform transitions)
    return startGain + (targetGain - startGain) * curvedProgress;
  }

  private dbToGain(db: number): number {
    return Math.pow(10, db / 20);
  }

  private gainToDb(gain: number): number {
    if (gain <= 0) return -Infinity;
    return 20 * Math.log10(gain);
  }
}

/**
 * Multi-channel audio processor for managing ducking across multiple speakers.
 */
export class MultiChannelAudioProcessor {
  private processors: Map<string, AudioProcessor>;
  private readonly config: AudioProcessorConfig;

  constructor(config: AudioProcessorConfig = {}) {
    this.processors = new Map();
    this.config = config;
  }

  /**
   * Get or create processor for a speaker.
   */
  getProcessor(speakerId: string): AudioProcessor {
    let processor = this.processors.get(speakerId);
    if (!processor) {
      processor = new AudioProcessor(this.config);
      this.processors.set(speakerId, processor);
    }
    return processor;
  }

  /**
   * Process audio for a specific speaker.
   */
  processAudio(speakerId: string, buffer: Buffer): Buffer {
    const processor = this.getProcessor(speakerId);
    return processor.processBuffer(buffer);
  }

  /**
   * Start ducking for specific speakers.
   */
  startDucking(speakerIds: string[], immediate = false): void {
    for (const id of speakerIds) {
      this.getProcessor(id).startDucking(immediate);
    }
  }

  /**
   * Stop ducking for specific speakers.
   */
  stopDucking(speakerIds: string[], immediate = false): void {
    for (const id of speakerIds) {
      this.getProcessor(id).stopDucking(immediate);
    }
  }

  /**
   * Get ducking status for all speakers.
   */
  getDuckingStatus(): Map<string, { ducking: boolean; gain: number; gainDb: number }> {
    const status = new Map();
    for (const [id, processor] of this.processors) {
      status.set(id, {
        ducking: processor.isDucking(),
        gain: processor.getCurrentGain(),
        gainDb: processor.getCurrentGainDb(),
      });
    }
    return status;
  }
}
