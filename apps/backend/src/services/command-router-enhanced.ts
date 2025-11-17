import type { SpeakerId } from "@basil/shared";

export type CommandAction = "address" | "thinking" | "broadcast" | "barge-in-control" | "ducking-control";

export interface CommandRouteResult {
  raw: string;
  normalized: string;
  targets: SpeakerId[];
  remainder: string;
  action: CommandAction;
  durationMs?: number;
  confidence: number;
  matchedKeywords?: string[];
  fuzzyMatched?: boolean;
  context?: CommandContext;
}

export interface CommandContext {
  lastAddressed?: SpeakerId[];
  lastAction?: CommandAction;
  timestamp: number;
  sessionContext?: string;
}

interface FuzzyMatch {
  keyword: string;
  distance: number;
  confidence: number;
}

/**
 * Enhanced command router with fuzzy matching, context awareness, and better intent detection.
 *
 * Features:
 * - Fuzzy matching for misspelled agent names
 * - Context awareness (remembers who was last addressed)
 * - Multi-pattern intent detection with confidence scoring
 * - Command history and learning
 * - Priority-based multi-agent targeting
 * - Natural language understanding for complex commands
 */
export class EnhancedCommandRouter {
  private readonly addressKeywords = ["claude", "guest", "both", "everyone", "all", "showrunner", "autopilot", "basil"];
  private readonly thinkingKeywords = [
    "thinking", "think", "pause", "wait", "hold", "moment", "beat", "countdown",
    "processing", "consider", "ponder", "reflect"
  ];
  private readonly bargeInKeywords = [
    "interrupt", "stop", "halt", "quiet", "silence", "mute", "hold up", "wait a minute"
  ];
  private readonly duckingKeywords = [
    "lower", "reduce", "quieter", "softer", "volume down", "turn down"
  ];

  private context: CommandContext = {
    timestamp: Date.now(),
  };

  // Fuzzy matching threshold (Levenshtein distance)
  private readonly fuzzyThreshold = 2;

  /**
   * Route a command with enhanced detection and context awareness.
   */
  route(text: string, previousContext?: CommandContext): CommandRouteResult | null {
    const raw = text.trim();
    if (!raw) return null;

    const normalized = raw.toLowerCase();

    // Update context
    if (previousContext) {
      this.context = { ...previousContext, timestamp: Date.now() };
    }

    // Check for special commands first
    const bargeInCmd = this.detectBargeInControl(normalized);
    if (bargeInCmd) return bargeInCmd;

    const duckingCmd = this.detectDuckingControl(normalized);
    if (duckingCmd) return duckingCmd;

    // Extract address with fuzzy matching
    const addressed = this.extractAddress(normalized);
    const targets = addressed?.targets ?? ([] as SpeakerId[]);
    const remainder = addressed?.remainder ?? normalized;

    // Detect action with context
    const action = this.detectAction(remainder, targets, normalized);

    // Handle context-based addressing (e.g., "continue", "also", "and you too")
    const contextTargets = this.resolveContextualTargets(normalized, targets);
    const finalTargets = contextTargets.length > 0 ? contextTargets : targets;

    if (finalTargets.length === 0 && action === "address") {
      return null;
    }

    // Resolve default targets for thinking mode
    const resolvedTargets =
      action === "thinking" && finalTargets.length === 0
        ? (["claude"] satisfies SpeakerId[])
        : finalTargets;

    const durationMs = action === "thinking" ? this.extractDuration(remainder) : undefined;

    const result: CommandRouteResult = {
      raw,
      normalized,
      targets: resolvedTargets,
      remainder,
      action,
      durationMs,
      confidence: addressed?.confidence ?? (resolvedTargets.length ? 0.5 : 0.3),
      matchedKeywords: addressed?.matchedKeywords,
      fuzzyMatched: addressed?.fuzzyMatched,
      context: { ...this.context },
    };

    // Update context for future commands
    if (resolvedTargets.length > 0) {
      this.context.lastAddressed = resolvedTargets;
      this.context.lastAction = action;
      this.context.timestamp = Date.now();
    }

    return result;
  }

  /**
   * Get current context.
   */
  getContext(): CommandContext {
    return { ...this.context };
  }

  /**
   * Reset context.
   */
  resetContext(): void {
    this.context = {
      timestamp: Date.now(),
    };
  }

  private extractAddress(normalized: string): {
    targets: SpeakerId[];
    remainder: string;
    confidence: number;
    matchedKeywords?: string[];
    fuzzyMatched?: boolean;
  } | null {
    // Direct pattern with optional "hey" and various separators
    const directPattern = /^(?:hey\s+)?@?(claude|guest|both|everyone|all|showrunner|autopilot|basil)[:\-,\s]+/i;
    const directMatch = normalized.match(directPattern);

    if (directMatch) {
      const keyword = directMatch[1];
      const targets = this.mapKeywordToTargets(keyword);
      const remainder = normalized.slice(directMatch[0].length).trim();
      return {
        targets,
        remainder,
        confidence: 0.9,
        matchedKeywords: [keyword],
        fuzzyMatched: false,
      };
    }

    // Check for keyword at start with separator
    for (const keyword of this.addressKeywords) {
      if (normalized.startsWith(`${keyword},`) || normalized.startsWith(`${keyword} `)) {
        const targets = this.mapKeywordToTargets(keyword);
        const remainder = normalized.slice(keyword.length).replace(/^[,\s]+/, "");
        return {
          targets,
          remainder,
          confidence: 0.7,
          matchedKeywords: [keyword],
          fuzzyMatched: false,
        };
      }
    }

    // Check for inline addresses like "Claude --" or "Claude:" later in the text
    for (const keyword of this.addressKeywords) {
      const inlinePattern = new RegExp(`\\b${keyword}[\\s,:-]+`, "i");
      const match = normalized.match(inlinePattern);
      if (match && match.index !== undefined && match.index < 20) {
        const targets = this.mapKeywordToTargets(keyword);
        const remainder = normalized.slice(match.index + match[0].length).trim();
        return {
          targets,
          remainder,
          confidence: 0.55,
          matchedKeywords: [keyword],
          fuzzyMatched: false,
        };
      }
    }

    // Fuzzy matching for misspelled names
    const fuzzyResult = this.fuzzyMatchAddress(normalized);
    if (fuzzyResult) {
      return fuzzyResult;
    }

    return null;
  }

  private fuzzyMatchAddress(normalized: string): {
    targets: SpeakerId[];
    remainder: string;
    confidence: number;
    matchedKeywords?: string[];
    fuzzyMatched?: boolean;
  } | null {
    const words = normalized.split(/\s+/);

    // Check first few words for fuzzy matches
    for (let i = 0; i < Math.min(3, words.length); i++) {
      const word = words[i];

      for (const keyword of this.addressKeywords) {
        const distance = this.levenshteinDistance(word, keyword);

        if (distance <= this.fuzzyThreshold && distance > 0) {
          // Found a fuzzy match
          const confidence = 1 - (distance / keyword.length);

          if (confidence >= 0.6) {
            const targets = this.mapKeywordToTargets(keyword);
            const remainder = words.slice(i + 1).join(" ");

            return {
              targets,
              remainder,
              confidence: confidence * 0.7, // Reduce confidence for fuzzy match
              matchedKeywords: [keyword],
              fuzzyMatched: true,
            };
          }
        }
      }
    }

    return null;
  }

  private resolveContextualTargets(normalized: string, explicitTargets: SpeakerId[]): SpeakerId[] {
    // If explicit targets exist, use them
    if (explicitTargets.length > 0) return explicitTargets;

    // Check for contextual continuation phrases
    const continuationPatterns = [
      /^(and\s+)?(also|too|as well)/,
      /^continue/,
      /^same\s+to\s+you/,
      /^you\s+too/,
    ];

    for (const pattern of continuationPatterns) {
      if (pattern.test(normalized) && this.context.lastAddressed) {
        return this.context.lastAddressed;
      }
    }

    // Check for "the same" or "ditto" which implies context
    if ((/\b(same|ditto)\b/.test(normalized)) && this.context.lastAddressed) {
      return this.context.lastAddressed;
    }

    return [];
  }

  private detectAction(remainder: string, targets: SpeakerId[], fullText: string): CommandAction {
    const trimmed = remainder.trim();
    if (!trimmed) return targets.length ? "address" : "broadcast";

    // Check for barge-in control
    if (this.bargeInKeywords.some(kw => trimmed.includes(kw))) {
      return "barge-in-control";
    }

    // Check for ducking control
    if (this.duckingKeywords.some(kw => trimmed.includes(kw))) {
      return "ducking-control";
    }

    // Check for thinking mode with multiple patterns
    const thinkingPatterns = [
      /thinking\s+mode/,
      /take\s+a\s+(beat|moment|second)/,
      /need\s+to\s+think/,
      /give\s+(me|us|them)\s+(\d+)?\s*(seconds?|minutes?|time)/,
      /countdown/,
      /time\s+to\s+(think|process|consider)/,
      /let\s+(me|us|them)\s+(think|process|ponder)/,
      /pause\s+(for|to)/,
    ];

    // Also check for thinking keywords
    const hasThinkingKeyword = this.thinkingKeywords.some(kw => trimmed.includes(kw));
    const hasThinkingPattern = thinkingPatterns.some(pattern => pattern.test(trimmed));

    if (hasThinkingKeyword || hasThinkingPattern) {
      return "thinking";
    }

    return targets.length ? "address" : "broadcast";
  }

  private detectBargeInControl(normalized: string): CommandRouteResult | null {
    const bargeInPatterns = [
      { pattern: /\b(stop|halt|interrupt|quiet|silence)\b/, confidence: 0.8 },
      { pattern: /\b(hold\s+up|wait\s+a\s+minute)\b/, confidence: 0.75 },
      { pattern: /\bmute\s+(everyone|all)\b/, confidence: 0.85 },
    ];

    for (const { pattern, confidence } of bargeInPatterns) {
      if (pattern.test(normalized)) {
        return {
          raw: normalized,
          normalized,
          targets: ["claude", "guest"] as SpeakerId[],
          remainder: "",
          action: "barge-in-control",
          confidence,
          context: { ...this.context },
        };
      }
    }

    return null;
  }

  private detectDuckingControl(normalized: string): CommandRouteResult | null {
    const duckingPatterns = [
      { pattern: /\b(lower|reduce|quieter|softer)\s+(volume|sound)\b/, confidence: 0.8 },
      { pattern: /\bturn\s+down\b/, confidence: 0.75 },
      { pattern: /\bvolume\s+down\b/, confidence: 0.8 },
    ];

    for (const { pattern, confidence } of duckingPatterns) {
      if (pattern.test(normalized)) {
        return {
          raw: normalized,
          normalized,
          targets: ["claude", "guest"] as SpeakerId[],
          remainder: "",
          action: "ducking-control",
          confidence,
          context: { ...this.context },
        };
      }
    }

    return null;
  }

  private extractDuration(remainder: string): number {
    // Match explicit durations
    const secondsMatch = remainder.match(/(\d+)\s*(seconds?|secs?|s\b)/);
    if (secondsMatch) {
      return Number.parseInt(secondsMatch[1], 10) * 1000;
    }

    const minutesMatch = remainder.match(/(\d+)\s*(minutes?|mins?|m\b)/);
    if (minutesMatch) {
      return Number.parseInt(minutesMatch[1], 10) * 60_000;
    }

    // Check for implicit durations
    if (/\b(quick|brief|short)\s+(moment|pause|beat)/.test(remainder)) {
      return 10_000; // 10 seconds
    }

    if (/\blong\s+(moment|pause|beat)/.test(remainder)) {
      return 60_000; // 1 minute
    }

    return 30_000; // Default 30 seconds
  }

  private mapKeywordToTargets(keyword: string): SpeakerId[] {
    switch (keyword) {
      case "claude":
        return ["claude"];
      case "guest":
        return ["guest"];
      case "basil":
        return ["you"];
      case "both":
      case "everyone":
      case "all":
        return ["claude", "guest"];
      case "showrunner":
      case "autopilot":
        return ["claude"];
      default:
        return [];
    }
  }

  /**
   * Compute Levenshtein distance between two strings.
   * Used for fuzzy matching.
   */
  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
