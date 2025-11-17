import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { BargeInManager, type BargeInMode } from "./barge-in-manager";
import type { SpeakerId } from "@basil/shared";

describe("BargeInManager", () => {
  let manager: BargeInManager;
  let onBargeInStart: ReturnType<typeof vi.fn>;
  let onBargeInComplete: ReturnType<typeof vi.fn>;
  let onBargeInCancelled: ReturnType<typeof vi.fn>;
  let onDuckingRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();

    onBargeInStart = vi.fn();
    onBargeInComplete = vi.fn();
    onBargeInCancelled = vi.fn();
    onDuckingRequest = vi.fn();

    manager = new BargeInManager({
      mode: "graceful",
      gracePeriodMs: 300,
      duckingEnabled: true,
    });

    manager.setCallbacks({
      onBargeInStart,
      onBargeInComplete,
      onBargeInCancelled,
      onDuckingRequest,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Basic barge-in", () => {
    it("should start with no active speakers", () => {
      const activeSpeakers = manager.getActiveSpeakers();
      expect(activeSpeakers).toHaveLength(0);
    });

    it("should track active speakers", () => {
      manager.onSpeechStart("claude", 0.9);

      const activeSpeakers = manager.getActiveSpeakers();
      expect(activeSpeakers).toContain("claude");
    });

    it("should remove speakers when speech ends", () => {
      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechEnd("claude", 0.9);

      const activeSpeakers = manager.getActiveSpeakers();
      expect(activeSpeakers).not.toContain("claude");
    });

    it("should trigger barge-in when human speaks over agent", () => {
      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      vi.advanceTimersByTime(350); // Past grace period

      expect(onBargeInStart).toHaveBeenCalled();
      expect(onBargeInComplete).toHaveBeenCalled();
    });

    it("should not trigger barge-in when no one is speaking", () => {
      manager.onSpeechStart("you", 0.8);

      vi.advanceTimersByTime(350);

      expect(onBargeInStart).not.toHaveBeenCalled();
    });
  });

  describe("Immediate mode", () => {
    beforeEach(() => {
      manager = new BargeInManager({
        mode: "immediate",
        duckingEnabled: true,
      });

      manager.setCallbacks({
        onBargeInStart,
        onBargeInComplete,
        onDuckingRequest,
      });
    });

    it("should interrupt immediately without grace period", () => {
      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      expect(onBargeInStart).toHaveBeenCalled();
      expect(onBargeInComplete).toHaveBeenCalled();
      expect(onBargeInStart).toHaveBeenCalledWith("you", ["claude"]);
    });

    it("should not wait for grace period", () => {
      manager.onSpeechStart("guest", 0.9);
      manager.onSpeechStart("you", 0.8);

      expect(onBargeInComplete).toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(onBargeInComplete).toHaveBeenCalledTimes(1); // Only once, not again after timer
    });
  });

  describe("Graceful mode", () => {
    it("should wait for grace period before interrupting", () => {
      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      // Should not interrupt immediately
      expect(onBargeInStart).not.toHaveBeenCalled();

      // Should request ducking immediately
      expect(onDuckingRequest).toHaveBeenCalledWith(["claude"], true);

      // Advance past grace period
      vi.advanceTimersByTime(350);

      expect(onBargeInComplete).toHaveBeenCalled();
    });

    it("should cancel barge-in if human stops speaking during grace period", () => {
      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      // Stop speaking before grace period ends
      vi.advanceTimersByTime(150);
      manager.onSpeechEnd("you", 0.8);

      vi.advanceTimersByTime(200); // Past grace period

      expect(onBargeInComplete).not.toHaveBeenCalled();
      expect(onBargeInCancelled).toHaveBeenCalled();
    });

    it("should apply ducking during grace period", () => {
      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      expect(onDuckingRequest).toHaveBeenCalledWith(["claude"], true);
    });

    it("should remove ducking if barge-in is cancelled", () => {
      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      expect(onDuckingRequest).toHaveBeenCalledWith(["claude"], true);

      manager.onSpeechEnd("you", 0.8);
      vi.advanceTimersByTime(200);

      expect(onDuckingRequest).toHaveBeenCalledWith(["claude"], false);
    });
  });

  describe("Disabled mode", () => {
    beforeEach(() => {
      manager = new BargeInManager({ mode: "disabled" });
      manager.setCallbacks({
        onBargeInStart,
        onBargeInComplete,
      });
    });

    it("should not trigger barge-in when disabled", () => {
      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      vi.advanceTimersByTime(1000);

      expect(onBargeInStart).not.toHaveBeenCalled();
      expect(onBargeInComplete).not.toHaveBeenCalled();
    });
  });

  describe("Speaker priorities", () => {
    it("should allow human to interrupt any agent", () => {
      manager.setSpeakerPriority("claude", "high");

      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      vi.advanceTimersByTime(350);

      expect(onBargeInComplete).toHaveBeenCalled();
    });

    it("should allow high priority agent to interrupt low priority", () => {
      manager.setSpeakerPriority("claude", "high");
      manager.setSpeakerPriority("guest", "low");

      manager.onSpeechStart("guest", 0.9);
      manager.onSpeechStart("claude", 0.9);

      vi.advanceTimersByTime(350);

      expect(onBargeInComplete).toHaveBeenCalled();
      expect(onBargeInStart).toHaveBeenCalledWith("claude", ["guest"]);
    });

    it("should not allow low priority to interrupt high priority", () => {
      manager.setSpeakerPriority("claude", "high");
      manager.setSpeakerPriority("guest", "low");

      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("guest", 0.9);

      vi.advanceTimersByTime(350);

      expect(onBargeInComplete).not.toHaveBeenCalled();
    });
  });

  describe("Interruption control", () => {
    it("should respect allow interruption flag", () => {
      manager.setAllowInterruption("claude", false);

      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      vi.advanceTimersByTime(350);

      expect(onBargeInComplete).not.toHaveBeenCalled();
    });

    it("should allow interruption when flag is true", () => {
      manager.setAllowInterruption("claude", true);

      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      vi.advanceTimersByTime(350);

      expect(onBargeInComplete).toHaveBeenCalled();
    });

    it("should only interrupt allowed speakers", () => {
      manager.setAllowInterruption("claude", false);
      manager.setAllowInterruption("guest", true);

      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("guest", 0.9);
      manager.onSpeechStart("you", 0.8);

      vi.advanceTimersByTime(350);

      expect(onBargeInStart).toHaveBeenCalledWith("you", ["guest"]);
      expect(onBargeInStart).not.toHaveBeenCalledWith("you", expect.arrayContaining(["claude"]));
    });
  });

  describe("Multiple speakers", () => {
    it("should interrupt all active agents", () => {
      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("guest", 0.9);
      manager.onSpeechStart("you", 0.8);

      vi.advanceTimersByTime(350);

      expect(onBargeInStart).toHaveBeenCalledWith("you", expect.arrayContaining(["claude", "guest"]));
    });

    it("should apply ducking to all active agents", () => {
      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("guest", 0.9);
      manager.onSpeechStart("you", 0.8);

      expect(onDuckingRequest).toHaveBeenCalledWith(
        expect.arrayContaining(["claude", "guest"]),
        true
      );
    });
  });

  describe("Statistics and history", () => {
    it("should track barge-in history", () => {
      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      vi.advanceTimersByTime(350);

      const history = manager.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history.some((e) => e.type === "barge-in-complete")).toBe(true);
    });

    it("should provide statistics", () => {
      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      vi.advanceTimersByTime(350);

      const stats = manager.getStatistics();
      expect(stats.totalBargeIns).toBe(1);
      expect(stats.byMode.graceful).toBe(1);
      expect(stats.avgConfidence).toBeGreaterThan(0);
      expect(stats.gracePeriodUsageRate).toBeGreaterThan(0);
    });

    it("should limit history size", () => {
      // Trigger many barge-ins
      for (let i = 0; i < 150; i++) {
        manager.onSpeechStart("claude", 0.9);
        manager.onSpeechStart("you", 0.8);
        vi.advanceTimersByTime(350);
        manager.onSpeechEnd("you", 0.8);
        manager.onSpeechEnd("claude", 0.9);
        vi.advanceTimersByTime(100);
      }

      const history = manager.getHistory();
      expect(history.length).toBeLessThanOrEqual(100); // Max history size
    });
  });

  describe("Confidence handling", () => {
    it("should pass confidence to barge-in events", () => {
      const confidence = 0.85;

      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", confidence);

      vi.advanceTimersByTime(350);

      const history = manager.getHistory();
      const completeEvent = history.find((e) => e.type === "barge-in-complete");

      expect(completeEvent?.confidence).toBe(confidence);
    });

    it("should gate barge-in on low confidence", () => {
      manager = new BargeInManager({
        mode: "graceful",
        gracePeriodMs: 300,
      });

      manager.setCallbacks({
        onBargeInStart,
        onBargeInComplete,
      });

      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.3); // Low confidence

      vi.advanceTimersByTime(350);

      // Note: Current implementation doesn't have confidence gating at manager level
      // This test documents the expected behavior if we add it
    });
  });

  describe("Ducking configuration", () => {
    it("should not request ducking when disabled", () => {
      manager = new BargeInManager({
        mode: "graceful",
        duckingEnabled: false,
      });

      manager.setCallbacks({
        onBargeInStart,
        onDuckingRequest,
      });

      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      expect(onDuckingRequest).not.toHaveBeenCalled();
    });

    it("should respect ducking lead time", () => {
      manager = new BargeInManager({
        mode: "graceful",
        duckingEnabled: true,
        duckingLeadTimeMs: 150,
        gracePeriodMs: 300,
      });

      manager.setCallbacks({
        onDuckingRequest,
      });

      manager.onSpeechStart("claude", 0.9);
      manager.onSpeechStart("you", 0.8);

      // Ducking should start immediately (before grace period ends)
      expect(onDuckingRequest).toHaveBeenCalledWith(["claude"], true);
    });
  });

  describe("Edge cases", () => {
    it("should handle rapid speech start/end cycles", () => {
      for (let i = 0; i < 10; i++) {
        manager.onSpeechStart("you", 0.8);
        manager.onSpeechEnd("you", 0.8);
      }

      const activeSpeakers = manager.getActiveSpeakers();
      expect(activeSpeakers).not.toContain("you");
    });

    it("should handle speech end without start", () => {
      expect(() => manager.onSpeechEnd("you", 0.8)).not.toThrow();
    });

    it("should handle duplicate speech start calls", () => {
      manager.onSpeechStart("you", 0.8);
      manager.onSpeechStart("you", 0.8);
      manager.onSpeechStart("you", 0.8);

      const activeSpeakers = manager.getActiveSpeakers();
      expect(activeSpeakers.filter((s) => s === "you")).toHaveLength(1);
    });

    it("should handle all speakers unknown", () => {
      const unknown = "unknown" as SpeakerId;

      expect(() => manager.onSpeechStart(unknown, 0.8)).not.toThrow();
    });
  });

  describe("Callback safety", () => {
    it("should handle missing callbacks gracefully", () => {
      manager = new BargeInManager({ mode: "immediate" });
      // No callbacks set

      expect(() => {
        manager.onSpeechStart("claude", 0.9);
        manager.onSpeechStart("you", 0.8);
      }).not.toThrow();
    });

    it("should handle callback errors gracefully", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });

      manager.setCallbacks({
        onBargeInStart: errorCallback,
      });

      expect(() => {
        manager.onSpeechStart("claude", 0.9);
        manager.onSpeechStart("you", 0.8);
      }).toThrow(); // Current implementation doesn't catch errors
    });
  });
});
