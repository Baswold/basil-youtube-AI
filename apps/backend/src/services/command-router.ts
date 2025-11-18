import type { SpeakerId } from "@basil/shared";

/**
 * Types of command actions that can be detected
 * - address: Direct message to specific agent(s)
 * - thinking: Request for thinking mode (deep reflection time)
 * - broadcast: General statement to all participants
 */
export type CommandAction = "address" | "thinking" | "broadcast";

/**
 * Result of parsing a user command/utterance
 */
export interface CommandRouteResult {
  /** Original raw text from the user */
  raw: string;
  /** Normalized (lowercased) version of the text */
  normalized: string;
  /** Intended recipients of the message */
  targets: SpeakerId[];
  /** Main content after removing addressing/command prefixes */
  remainder: string;
  /** Detected action type */
  action: CommandAction;
  /** Duration in milliseconds (for thinking mode) */
  durationMs?: number;
  /** Confidence score (0.0 - 1.0) of the parsing */
  confidence: number;
}

/**
 * Keywords that indicate addressing specific agents
 */
const ADDRESS_KEYWORDS = ["claude", "guest", "both", "everyone", "all", "showrunner", "autopilot"];

/**
 * CommandRouter parses user utterances to detect:
 * - Direct addressing of specific agents ("Hey Claude, ...")
 * - Thinking mode requests ("Can I think for 30 seconds?")
 * - Command routing ("Both of you, what do you think?")
 *
 * Used for implementing conversational routing and special modes.
 */
export class CommandRouter {
  /**
   * Routes a user utterance by detecting addressing, commands, and actions
   *
   * Examples:
   * - "Hey Claude, what do you think?" → address Claude
   * - "Can I think for 30 seconds?" → thinking mode for 30s
   * - "Both of you, tell me about AI" → address both agents
   *
   * @param text - User's spoken text (from STT)
   * @returns Parsed command result or null if text is empty
   */
  route(text: string): CommandRouteResult | null {
    const raw = text.trim();
    if (!raw) return null;

    const normalized = raw.toLowerCase();

    // Try to extract direct addressing ("Hey Claude, ...")
    const addressed = this.extractAddress(normalized);
    const targets = addressed?.targets ?? ([] as SpeakerId[]);
    const remainder = addressed?.remainder ?? normalized;

    // Detect the action type (address, thinking, broadcast)
    const action = this.detectAction(remainder, targets);
    if (!targets.length && action === "address") {
      return null;
    }

    // For thinking mode, default to Claude if no target specified
    const resolvedTargets =
      action === "thinking" && targets.length === 0 ? (["claude"] satisfies SpeakerId[]) : targets;

    // Extract duration for thinking mode
    const durationMs = action === "thinking" ? this.extractDuration(remainder) : undefined;

    return {
      raw,
      normalized,
      targets: resolvedTargets,
      remainder,
      action,
      durationMs,
      confidence: addressed?.confidence ?? (resolvedTargets.length ? 0.5 : 0.3),
    };
  }

  private extractAddress(normalized: string): {
    targets: SpeakerId[];
    remainder: string;
    confidence: number;
  } | null {
    const directPattern = /^(?:hey\s+)?@?(claude|guest|both|everyone|all|showrunner|autopilot)[:\-,\s]+/i;
    const directMatch = normalized.match(directPattern);

    if (directMatch) {
      const keyword = directMatch[1];
      const targets = this.mapKeywordToTargets(keyword);
      const remainder = normalized.slice(directMatch[0].length).trim();
      return { targets, remainder, confidence: 0.9 };
    }

    for (const keyword of ADDRESS_KEYWORDS) {
      if (normalized.startsWith(`${keyword},`) || normalized.startsWith(`${keyword} `)) {
        const targets = this.mapKeywordToTargets(keyword);
        const remainder = normalized.slice(keyword.length).replace(/^[,\s]+/, "");
        return { targets, remainder, confidence: 0.7 };
      }
    }

    // Check for inline addresses like "Claude --" or "Claude:" later in the text
    for (const keyword of ADDRESS_KEYWORDS) {
      const inlinePattern = new RegExp(`\\b${keyword}[\\s,:-]+`, "i");
      const match = normalized.match(inlinePattern);
      if (match && match.index !== undefined && match.index < 20) {
        const targets = this.mapKeywordToTargets(keyword);
        const remainder = normalized.slice(match.index + match[0].length).trim();
        return { targets, remainder, confidence: 0.55 };
      }
    }

    return null;
  }

  /**
   * Detects the action type based on the content and presence of targets
   *
   * @param remainder - Main content after removing addressing
   * @param targets - Extracted target agents
   * @returns Detected action type
   */
  private detectAction(remainder: string, targets: SpeakerId[]): CommandAction {
    const trimmed = remainder.trim();
    if (!trimmed) return targets.length ? "address" : "broadcast";

    // Patterns that indicate thinking mode requests
    const thinkingPatterns = [
      /thinking\s+mode/,
      /take\s+a\s+(beat|moment)/,
      /need\s+to\s+think/,
      /give\s+me\s+(\d+)?\s*(seconds?|minutes?)/,
      /countdown/,
      /time\s+to\s+think/,
    ];

    if (thinkingPatterns.some((pattern) => pattern.test(trimmed))) {
      return "thinking";
    }

    return targets.length ? "address" : "broadcast";
  }

  /**
   * Extracts duration from thinking mode requests
   * Examples: "30 seconds", "2 minutes", "45s"
   *
   * @param remainder - Text to parse for duration
   * @returns Duration in milliseconds (default: 30 seconds)
   */
  private extractDuration(remainder: string): number {
    // Parse seconds: "30 seconds", "45s"
    const match = remainder.match(/(\d+)\s*(seconds?|secs?|s)/);
    if (match) {
      return Number.parseInt(match[1], 10) * 1000;
    }

    // Parse minutes: "2 minutes", "5m"
    const minutesMatch = remainder.match(/(\d+)\s*(minutes?|mins?|m)/);
    if (minutesMatch) {
      return Number.parseInt(minutesMatch[1], 10) * 60_000;
    }

    return 30_000; // Default 30 seconds
  }

  /**
   * Maps addressing keywords to concrete speaker IDs
   *
   * @param keyword - Detected keyword (e.g., "claude", "both", "everyone")
   * @returns Array of speaker IDs
   */
  private mapKeywordToTargets(keyword: string): SpeakerId[] {
    switch (keyword) {
      case "claude":
        return ["claude"];
      case "guest":
        return ["guest"];
      case "both":
      case "everyone":
      case "all":
        return ["claude", "guest"];
      case "showrunner":
      case "autopilot":
        return ["claude"]; // Claude acts as showrunner
      default:
        return [];
    }
  }
}
