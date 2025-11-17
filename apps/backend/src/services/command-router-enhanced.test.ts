import { describe, it, expect, beforeEach } from "vitest";
import { EnhancedCommandRouter, type CommandContext } from "./command-router-enhanced";

describe("EnhancedCommandRouter", () => {
  let router: EnhancedCommandRouter;

  beforeEach(() => {
    router = new EnhancedCommandRouter();
  });

  describe("Basic addressing", () => {
    it("should route to Claude", () => {
      const result = router.route("Claude, what do you think?");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("claude");
      expect(result?.action).toBe("address");
      expect(result?.confidence).toBeGreaterThan(0.5);
    });

    it("should route to guest", () => {
      const result = router.route("Guest, your thoughts?");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("guest");
      expect(result?.remainder).toBe("your thoughts?");
    });

    it("should route to both agents", () => {
      const result = router.route("Both of you, please respond");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("claude");
      expect(result?.targets).toContain("guest");
      expect(result?.action).toBe("address");
    });

    it("should handle 'everyone' keyword", () => {
      const result = router.route("Everyone listen up");

      expect(result).toBeDefined();
      expect(result?.targets).toHaveLength(2);
      expect(result?.targets).toContain("claude");
      expect(result?.targets).toContain("guest");
    });

    it("should handle 'basil' addressing user", () => {
      const result = router.route("Basil, what are you doing?");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("you");
    });
  });

  describe("Fuzzy matching", () => {
    it("should match misspelled 'Claude'", () => {
      const result = router.route("Claud, what do you think?");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("claude");
      expect(result?.fuzzyMatched).toBe(true);
      expect(result?.matchedKeywords).toContain("claude");
    });

    it("should match misspelled 'guest'", () => {
      const result = router.route("Gest, your opinion?");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("guest");
      expect(result?.fuzzyMatched).toBe(true);
    });

    it("should have lower confidence for fuzzy matches", () => {
      const exact = router.route("Claude, respond");
      const fuzzy = router.route("Claud, respond");

      expect(exact?.confidence).toBeGreaterThan(fuzzy?.confidence || 0);
    });

    it("should not match strings too different from keywords", () => {
      const result = router.route("John, what do you think?");

      // Should not fuzzy match to any agent
      expect(result?.fuzzyMatched || false).toBe(false);
    });
  });

  describe("Thinking mode detection", () => {
    it("should detect 'thinking mode' command", () => {
      const result = router.route("Claude, enter thinking mode");

      expect(result).toBeDefined();
      expect(result?.action).toBe("thinking");
      expect(result?.targets).toContain("claude");
    });

    it("should detect 'take a moment' command", () => {
      const result = router.route("Take a moment to think");

      expect(result).toBeDefined();
      expect(result?.action).toBe("thinking");
      expect(result?.durationMs).toBeDefined();
    });

    it("should extract duration from command", () => {
      const result = router.route("Give me 30 seconds");

      expect(result).toBeDefined();
      expect(result?.action).toBe("thinking");
      expect(result?.durationMs).toBe(30_000);
    });

    it("should extract minutes duration", () => {
      const result = router.route("Take 2 minutes to think");

      expect(result).toBeDefined();
      expect(result?.durationMs).toBe(120_000);
    });

    it("should use default duration if not specified", () => {
      const result = router.route("Thinking mode");

      expect(result).toBeDefined();
      expect(result?.durationMs).toBe(30_000); // Default
    });

    it("should detect implicit durations", () => {
      const result = router.route("Take a quick moment");

      expect(result).toBeDefined();
      expect(result?.action).toBe("thinking");
      expect(result?.durationMs).toBe(10_000); // Short duration
    });

    it("should detect long duration phrases", () => {
      const result = router.route("Take a long pause");

      expect(result).toBeDefined();
      expect(result?.durationMs).toBe(60_000); // 1 minute
    });
  });

  describe("Context awareness", () => {
    it("should remember last addressed agent", () => {
      const first = router.route("Claude, hello");
      expect(first?.targets).toContain("claude");

      const second = router.route("Also respond to this");
      expect(second?.targets).toContain("claude");
    });

    it("should handle 'continue' with context", () => {
      router.route("Guest, what do you think?");

      const result = router.route("continue");
      expect(result?.targets).toContain("guest");
    });

    it("should handle 'same to you'", () => {
      router.route("Claude, analyze this");

      const result = router.route("same to you");
      expect(result?.targets).toContain("claude");
    });

    it("should handle 'you too'", () => {
      router.route("Guest, please respond");

      const result = router.route("you too");
      expect(result?.targets).toContain("guest");
    });

    it("should provide context in result", () => {
      const result = router.route("Claude, hello");

      expect(result?.context).toBeDefined();
      expect(result?.context?.lastAddressed).toContain("claude");
      expect(result?.context?.timestamp).toBeDefined();
    });

    it("should reset context correctly", () => {
      router.route("Claude, hello");
      router.resetContext();

      const context = router.getContext();
      expect(context.lastAddressed).toBeUndefined();
    });
  });

  describe("Barge-in control detection", () => {
    it("should detect stop command", () => {
      const result = router.route("Stop talking");

      expect(result).toBeDefined();
      expect(result?.action).toBe("barge-in-control");
    });

    it("should detect interrupt command", () => {
      const result = router.route("Interrupt please");

      expect(result).toBeDefined();
      expect(result?.action).toBe("barge-in-control");
    });

    it("should detect mute command", () => {
      const result = router.route("Mute everyone");

      expect(result).toBeDefined();
      expect(result?.action).toBe("barge-in-control");
    });

    it("should detect 'hold up' command", () => {
      const result = router.route("Hold up a minute");

      expect(result).toBeDefined();
      expect(result?.action).toBe("barge-in-control");
    });
  });

  describe("Ducking control detection", () => {
    it("should detect volume reduction command", () => {
      const result = router.route("Lower the volume");

      expect(result).toBeDefined();
      expect(result?.action).toBe("ducking-control");
    });

    it("should detect 'quieter' command", () => {
      const result = router.route("Make it quieter");

      expect(result).toBeDefined();
      expect(result?.action).toBe("ducking-control");
    });

    it("should detect 'turn down' command", () => {
      const result = router.route("Turn down the sound");

      expect(result).toBeDefined();
      expect(result?.action).toBe("ducking-control");
    });
  });

  describe("Address patterns", () => {
    it("should handle @ prefix", () => {
      const result = router.route("@claude respond please");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("claude");
      expect(result?.confidence).toBeGreaterThan(0.8);
    });

    it("should handle 'hey' prefix", () => {
      const result = router.route("hey guest, what's up?");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("guest");
    });

    it("should handle colon separator", () => {
      const result = router.route("Claude: please analyze");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("claude");
    });

    it("should handle dash separator", () => {
      const result = router.route("Guest - your thoughts?");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("guest");
    });

    it("should handle inline addresses", () => {
      const result = router.route("So Claude, what do you say?");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("claude");
      expect(result?.remainder).toContain("what do you say?");
    });
  });

  describe("Complex scenarios", () => {
    it("should handle multi-agent thinking mode", () => {
      const result = router.route("Both of you, take 10 seconds to think");

      expect(result).toBeDefined();
      expect(result?.action).toBe("thinking");
      expect(result?.targets).toContain("claude");
      expect(result?.targets).toContain("guest");
      expect(result?.durationMs).toBe(10_000);
    });

    it("should handle multiple keywords", () => {
      const result = router.route("Claude take a moment to ponder this");

      expect(result).toBeDefined();
      expect(result?.action).toBe("thinking");
      expect(result?.targets).toContain("claude");
    });

    it("should prioritize explicit address over context", () => {
      router.route("Claude, hello");

      const result = router.route("Guest, respond");

      expect(result?.targets).toContain("guest");
      expect(result?.targets).not.toContain("claude");
    });

    it("should handle case insensitivity", () => {
      const result = router.route("CLAUDE, RESPOND PLEASE");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("claude");
    });

    it("should extract remainder correctly", () => {
      const result = router.route("Claude, what is 2 + 2?");

      expect(result?.remainder).toBe("what is 2 + 2?");
      expect(result?.remainder).not.toContain("Claude");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string", () => {
      const result = router.route("");
      expect(result).toBeNull();
    });

    it("should handle whitespace-only string", () => {
      const result = router.route("   ");
      expect(result).toBeNull();
    });

    it("should handle text without commands", () => {
      const result = router.route("Just a normal sentence");

      expect(result).toBeDefined();
      expect(result?.action).toBe("broadcast");
      expect(result?.targets).toHaveLength(0);
    });

    it("should handle very long commands", () => {
      const longCommand = "Claude, " + "please ".repeat(100) + "respond";
      const result = router.route(longCommand);

      expect(result).toBeDefined();
      expect(result?.targets).toContain("claude");
    });

    it("should handle special characters", () => {
      const result = router.route("Claude, what about this: @#$%?");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("claude");
    });

    it("should handle unicode characters", () => {
      const result = router.route("Claude, écoutez ceci 你好");

      expect(result).toBeDefined();
      expect(result?.targets).toContain("claude");
    });
  });

  describe("Confidence scoring", () => {
    it("should have high confidence for direct address", () => {
      const result = router.route("@claude respond");

      expect(result?.confidence).toBeGreaterThan(0.8);
    });

    it("should have medium confidence for keyword start", () => {
      const result = router.route("claude respond");

      expect(result?.confidence).toBeGreaterThan(0.6);
      expect(result?.confidence).toBeLessThan(0.8);
    });

    it("should have lower confidence for inline address", () => {
      const result = router.route("So claude what do you think");

      expect(result?.confidence).toBeGreaterThan(0.5);
      expect(result?.confidence).toBeLessThan(0.7);
    });

    it("should have lowest confidence for fuzzy match", () => {
      const result = router.route("Claud respond");

      expect(result?.confidence).toBeGreaterThan(0.4);
      expect(result?.confidence).toBeLessThan(0.7);
    });
  });

  describe("Levenshtein distance", () => {
    it("should calculate distance correctly for identical strings", () => {
      // Access private method through routing
      const result = router.route("claude respond");
      expect(result?.fuzzyMatched).toBe(false); // Exact match
    });

    it("should calculate distance for one character difference", () => {
      const result = router.route("claud respond");
      expect(result?.fuzzyMatched).toBe(true);
      expect(result?.targets).toContain("claude");
    });

    it("should calculate distance for two character difference", () => {
      const result = router.route("claue respond");
      expect(result?.fuzzyMatched).toBe(true);
      expect(result?.targets).toContain("claude");
    });

    it("should not match when distance is too large", () => {
      const result = router.route("xyz respond");
      expect(result?.targets).not.toContain("claude");
    });
  });
});
