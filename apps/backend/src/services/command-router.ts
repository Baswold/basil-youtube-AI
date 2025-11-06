import type { SpeakerId } from "@basil/shared";

export type CommandAction = "address" | "thinking" | "broadcast";

export interface CommandRouteResult {
  raw: string;
  normalized: string;
  targets: SpeakerId[];
  remainder: string;
  action: CommandAction;
  durationMs?: number;
  confidence: number;
}

const ADDRESS_KEYWORDS = ["claude", "guest", "both", "everyone", "all", "showrunner", "autopilot"];

export class CommandRouter {
  route(text: string): CommandRouteResult | null {
    const raw = text.trim();
    if (!raw) return null;

    const normalized = raw.toLowerCase();

    const addressed = this.extractAddress(normalized);
    const targets = addressed?.targets ?? ([] as SpeakerId[]);
    const remainder = addressed?.remainder ?? normalized;

    const action = this.detectAction(remainder, targets);
    if (!targets.length && action === "address") {
      return null;
    }

    const resolvedTargets =
      action === "thinking" && targets.length === 0 ? (["claude"] satisfies SpeakerId[]) : targets;

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

  private detectAction(remainder: string, targets: SpeakerId[]): CommandAction {
    const trimmed = remainder.trim();
    if (!trimmed) return targets.length ? "address" : "broadcast";

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

  private extractDuration(remainder: string): number {
    const match = remainder.match(/(\d+)\s*(seconds?|secs?|s)/);
    if (match) {
      return Number.parseInt(match[1], 10) * 1000;
    }

    const minutesMatch = remainder.match(/(\d+)\s*(minutes?|mins?|m)/);
    if (minutesMatch) {
      return Number.parseInt(minutesMatch[1], 10) * 60_000;
    }

    return 30_000; // Default 30 seconds
  }

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
        return ["claude"];
      default:
        return [];
    }
  }
}
