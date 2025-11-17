import type { SpeakerId } from "@basil/shared";
import { EventLogger } from "./event-logger.js";

export type BargeInMode = "immediate" | "graceful" | "sentence-complete" | "disabled";
export type BargeInPriority = "low" | "medium" | "high";

export interface BargeInConfig {
  mode?: BargeInMode;
  gracePeriodMs?: number; // Delay before interrupting
  sentenceCompletionMaxMs?: number; // Max time to wait for sentence completion
  priority?: BargeInPriority;
  allowPartialInterruption?: boolean;
  duckingEnabled?: boolean;
  duckingLeadTimeMs?: number; // Start ducking this many ms before interruption
}

export interface BargeInEvent {
  type: "barge-in-start" | "barge-in-complete" | "barge-in-cancelled";
  timestamp: number;
  interrupter: SpeakerId;
  interrupted: SpeakerId[];
  mode: BargeInMode;
  confidence: number;
  gracePeriodUsed: boolean;
  duckingApplied: boolean;
}

export interface SpeakerState {
  id: SpeakerId;
  speaking: boolean;
  priority: BargeInPriority;
  startedAt?: number;
  lastActivityAt?: number;
  allowInterruption: boolean;
}

/**
 * Comprehensive barge-in manager with grace periods, partial interruption support,
 * and priority-based coordination.
 *
 * Features:
 * - Multiple barge-in modes (immediate, graceful, sentence-complete)
 * - Configurable grace periods to avoid false interruptions
 * - Priority-based speaker management
 * - Partial interruption support (allow current sentence to finish)
 * - Pre-ducking for smoother transitions
 * - Comprehensive event logging and analytics
 */
export class BargeInManager {
  private config: Required<BargeInConfig>;
  private speakerStates: Map<SpeakerId, SpeakerState>;
  private eventLogger?: EventLogger;
  private graceTimer?: NodeJS.Timeout;
  private pendingBargeIn?: {
    interrupter: SpeakerId;
    confidence: number;
    scheduledAt: number;
  };
  private bargeInHistory: BargeInEvent[] = [];
  private readonly maxHistorySize = 100;

  // Callbacks
  private onBargeInStart?: (interrupter: SpeakerId, interrupted: SpeakerId[]) => void;
  private onBargeInComplete?: (interrupter: SpeakerId, interrupted: SpeakerId[]) => void;
  private onBargeInCancelled?: () => void;
  private onDuckingRequest?: (speakers: SpeakerId[], enable: boolean) => void;

  constructor(
    config: BargeInConfig = {},
    eventLogger?: EventLogger
  ) {
    const defaults: Required<BargeInConfig> = {
      mode: "graceful",
      gracePeriodMs: 300, // 300ms grace period to avoid false interruptions
      sentenceCompletionMaxMs: 2000, // Wait up to 2s for sentence completion
      priority: "medium",
      allowPartialInterruption: true,
      duckingEnabled: true,
      duckingLeadTimeMs: 150, // Start ducking 150ms before interruption
    };

    this.config = { ...defaults, ...config };
    this.speakerStates = new Map();
    this.eventLogger = eventLogger;

    // Initialize speaker states
    const speakers: SpeakerId[] = ["you", "claude", "guest"];
    for (const id of speakers) {
      this.speakerStates.set(id, {
        id,
        speaking: false,
        priority: "medium",
        allowInterruption: true,
      });
    }
  }

  /**
   * Set callbacks for barge-in events.
   */
  setCallbacks(callbacks: {
    onBargeInStart?: (interrupter: SpeakerId, interrupted: SpeakerId[]) => void;
    onBargeInComplete?: (interrupter: SpeakerId, interrupted: SpeakerId[]) => void;
    onBargeInCancelled?: () => void;
    onDuckingRequest?: (speakers: SpeakerId[], enable: boolean) => void;
  }): void {
    this.onBargeInStart = callbacks.onBargeInStart;
    this.onBargeInComplete = callbacks.onBargeInComplete;
    this.onBargeInCancelled = callbacks.onBargeInCancelled;
    this.onDuckingRequest = callbacks.onDuckingRequest;
  }

  /**
   * Handle speech start event.
   * This initiates the barge-in detection process.
   */
  onSpeechStart(speaker: SpeakerId, confidence: number = 0.8): void {
    const state = this.speakerStates.get(speaker);
    if (!state) return;

    state.speaking = true;
    state.startedAt = Date.now();
    state.lastActivityAt = Date.now();

    // Check if this speaker should interrupt currently speaking agents
    const activeSpeakers = this.getActiveSpeakers().filter(s => s !== speaker);

    if (activeSpeakers.length > 0 && this.config.mode !== "disabled") {
      this.initiateBargeIn(speaker, activeSpeakers, confidence);
    }
  }

  /**
   * Handle speech end event.
   */
  onSpeechEnd(speaker: SpeakerId, confidence: number = 0.8): void {
    const state = this.speakerStates.get(speaker);
    if (!state) return;

    state.speaking = false;
    state.lastActivityAt = Date.now();

    // Cancel pending barge-in if it was from this speaker
    if (this.pendingBargeIn?.interrupter === speaker) {
      this.cancelBargeIn();
    }
  }

  /**
   * Update speaker priority (affects barge-in decisions).
   */
  setSpeakerPriority(speaker: SpeakerId, priority: BargeInPriority): void {
    const state = this.speakerStates.get(speaker);
    if (state) {
      state.priority = priority;
    }
  }

  /**
   * Enable or disable interruption for a specific speaker.
   */
  setAllowInterruption(speaker: SpeakerId, allow: boolean): void {
    const state = this.speakerStates.get(speaker);
    if (state) {
      state.allowInterruption = allow;
    }
  }

  /**
   * Get currently active (speaking) speakers.
   */
  getActiveSpeakers(): SpeakerId[] {
    return Array.from(this.speakerStates.values())
      .filter(s => s.speaking)
      .map(s => s.id);
  }

  /**
   * Get barge-in history for analysis.
   */
  getHistory(): BargeInEvent[] {
    return [...this.bargeInHistory];
  }

  /**
   * Get statistics on barge-in behavior.
   */
  getStatistics(): {
    totalBargeIns: number;
    byMode: Record<BargeInMode, number>;
    avgConfidence: number;
    gracePeriodUsageRate: number;
  } {
    const totalBargeIns = this.bargeInHistory.filter(e => e.type === "barge-in-complete").length;
    const byMode: Record<BargeInMode, number> = {
      immediate: 0,
      graceful: 0,
      "sentence-complete": 0,
      disabled: 0,
    };

    let totalConfidence = 0;
    let gracePeriodUsageCount = 0;

    for (const event of this.bargeInHistory) {
      if (event.type === "barge-in-complete") {
        byMode[event.mode]++;
        totalConfidence += event.confidence;
        if (event.gracePeriodUsed) gracePeriodUsageCount++;
      }
    }

    return {
      totalBargeIns,
      byMode,
      avgConfidence: totalBargeIns > 0 ? totalConfidence / totalBargeIns : 0,
      gracePeriodUsageRate: totalBargeIns > 0 ? gracePeriodUsageCount / totalBargeIns : 0,
    };
  }

  private initiateBargeIn(
    interrupter: SpeakerId,
    targets: SpeakerId[],
    confidence: number
  ): void {
    // Check if barge-in is allowed
    const allowedTargets = targets.filter(target => {
      const state = this.speakerStates.get(target);
      return state?.allowInterruption ?? false;
    });

    if (allowedTargets.length === 0) {
      return;
    }

    // Check priority (humans can always interrupt agents)
    const interrupterPriority = this.getPriorityLevel(interrupter);
    const canInterrupt = allowedTargets.every(target => {
      const targetPriority = this.getPriorityLevel(target);
      return interrupterPriority >= targetPriority || interrupter === "you";
    });

    if (!canInterrupt) {
      return;
    }

    // Apply barge-in mode logic
    switch (this.config.mode) {
      case "immediate":
        this.executeBargeIn(interrupter, allowedTargets, confidence, false);
        break;

      case "graceful":
        this.scheduleGracefulBargeIn(interrupter, allowedTargets, confidence);
        break;

      case "sentence-complete":
        this.scheduleSentenceCompleteBargeIn(interrupter, allowedTargets, confidence);
        break;

      case "disabled":
        break;
    }
  }

  private executeBargeIn(
    interrupter: SpeakerId,
    interrupted: SpeakerId[],
    confidence: number,
    gracePeriodUsed: boolean
  ): void {
    const event: BargeInEvent = {
      type: "barge-in-start",
      timestamp: Date.now(),
      interrupter,
      interrupted,
      mode: this.config.mode,
      confidence,
      gracePeriodUsed,
      duckingApplied: this.config.duckingEnabled,
    };

    this.logEvent(event);
    this.onBargeInStart?.(interrupter, interrupted);

    // Mark interrupted speakers as not speaking
    for (const speaker of interrupted) {
      const state = this.speakerStates.get(speaker);
      if (state) {
        state.speaking = false;
      }
    }

    // Complete event
    const completeEvent: BargeInEvent = {
      ...event,
      type: "barge-in-complete",
      timestamp: Date.now(),
    };

    this.logEvent(completeEvent);
    this.onBargeInComplete?.(interrupter, interrupted);

    this.pendingBargeIn = undefined;
  }

  private scheduleGracefulBargeIn(
    interrupter: SpeakerId,
    targets: SpeakerId[],
    confidence: number
  ): void {
    // Apply ducking immediately if enabled
    if (this.config.duckingEnabled) {
      this.onDuckingRequest?.(targets, true);
    }

    // Schedule the actual interruption after grace period
    this.pendingBargeIn = {
      interrupter,
      confidence,
      scheduledAt: Date.now(),
    };

    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
    }

    this.graceTimer = setTimeout(() => {
      // Check if interrupter is still speaking
      const interrupterState = this.speakerStates.get(interrupter);
      if (interrupterState?.speaking) {
        this.executeBargeIn(interrupter, targets, confidence, true);
      } else {
        this.cancelBargeIn();
        if (this.config.duckingEnabled) {
          this.onDuckingRequest?.(targets, false);
        }
      }
    }, this.config.gracePeriodMs);
  }

  private scheduleSentenceCompleteBargeIn(
    interrupter: SpeakerId,
    targets: SpeakerId[],
    confidence: number
  ): void {
    // Apply ducking immediately
    if (this.config.duckingEnabled) {
      this.onDuckingRequest?.(targets, true);
    }

    // Wait for natural pause or max timeout
    this.pendingBargeIn = {
      interrupter,
      confidence,
      scheduledAt: Date.now(),
    };

    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
    }

    // Force interruption after max timeout
    this.graceTimer = setTimeout(() => {
      const interrupterState = this.speakerStates.get(interrupter);
      if (interrupterState?.speaking) {
        this.executeBargeIn(interrupter, targets, confidence, true);
      } else {
        this.cancelBargeIn();
        if (this.config.duckingEnabled) {
          this.onDuckingRequest?.(targets, false);
        }
      }
    }, this.config.sentenceCompletionMaxMs);

    // TODO: In a full implementation, we would listen for STT punctuation
    // or TTS completion events to detect sentence boundaries
  }

  private cancelBargeIn(): void {
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = undefined;
    }

    if (this.pendingBargeIn) {
      const event: BargeInEvent = {
        type: "barge-in-cancelled",
        timestamp: Date.now(),
        interrupter: this.pendingBargeIn.interrupter,
        interrupted: [],
        mode: this.config.mode,
        confidence: this.pendingBargeIn.confidence,
        gracePeriodUsed: false,
        duckingApplied: false,
      };

      this.logEvent(event);
      this.onBargeInCancelled?.();
    }

    this.pendingBargeIn = undefined;
  }

  private getPriorityLevel(speaker: SpeakerId): number {
    // Humans always have highest priority
    if (speaker === "you") return 100;

    const state = this.speakerStates.get(speaker);
    if (!state) return 0;

    switch (state.priority) {
      case "high":
        return 75;
      case "medium":
        return 50;
      case "low":
        return 25;
      default:
        return 50;
    }
  }

  private logEvent(event: BargeInEvent): void {
    this.bargeInHistory.push(event);

    // Trim history if too long
    if (this.bargeInHistory.length > this.maxHistorySize) {
      this.bargeInHistory.shift();
    }

    // Log to event logger if available
    if (this.eventLogger && event.type === "barge-in-complete") {
      this.eventLogger.logBargeIn("session", event.interrupter, event.interrupted);
    }
  }
}
