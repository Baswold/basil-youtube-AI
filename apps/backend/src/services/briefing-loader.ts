import { promises as fs } from "node:fs";
import { join } from "node:path";

/**
 * Metadata extracted from briefing frontmatter
 */
export interface BriefingMetadata {
  /** Episode title */
  title?: string;
  /** Main topic of discussion */
  topic?: string;
  /** Desired conversational tone (e.g., "casual", "formal", "debate") */
  tone?: string;
  /** Key points that must be covered */
  mustCover?: string[];
  /** Topics to avoid */
  avoidTopics?: string[];
  /** Target duration in minutes */
  targetDuration?: number;
}

/**
 * Complete briefing with metadata and generated prompts
 */
export interface ParsedBriefing {
  /** Extracted metadata from frontmatter */
  metadata: BriefingMetadata;
  /** Main briefing content (markdown body) */
  content: string;
  /** System prompt tailored for Claude */
  systemPromptClaude: string;
  /** System prompt tailored for guest AI */
  systemPromptGuest: string;
}

/**
 * Loads and parses episode briefing files (markdown with YAML frontmatter)
 * Generates customized system prompts for Claude and guest AIs
 */
export class BriefingLoader {
  private briefingsDir: string;

  constructor(briefingsDir = "./briefings") {
    this.briefingsDir = briefingsDir;
  }

  /**
   * Loads a briefing file and generates system prompts
   *
   * @param briefingPath - Path to briefing file (relative to briefingsDir or absolute)
   * @returns Parsed briefing with metadata and prompts
   */
  async load(briefingPath: string): Promise<ParsedBriefing> {
    const fullPath = briefingPath.startsWith("/") 
      ? briefingPath 
      : join(this.briefingsDir, briefingPath);
    
    const content = await fs.readFile(fullPath, "utf-8");
    
    // Parse frontmatter and content
    const { metadata, body } = this.parseFrontmatter(content);
    
    // Generate system prompts
    const systemPromptClaude = this.generateClaudePrompt(metadata, body);
    const systemPromptGuest = this.generateGuestPrompt(metadata, body);
    
    return {
      metadata,
      content: body,
      systemPromptClaude,
      systemPromptGuest,
    };
  }

  private parseFrontmatter(content: string): { metadata: BriefingMetadata; body: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
      return { metadata: {}, body: content };
    }
    
    const [, frontmatter, body] = match;
    const metadata = this.parseYaml(frontmatter);
    
    return { metadata, body };
  }

  private parseYaml(yaml: string): BriefingMetadata {
    const metadata: BriefingMetadata = {};
    const lines = yaml.split("\n");
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) continue;
      
      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();
      
      // Handle arrays
      if (key === "mustCover" || key === "avoidTopics") {
        if (!metadata[key]) {
          metadata[key] = [];
        }
        if (value.startsWith("[") && value.endsWith("]")) {
          // Parse inline array: [item1, item2, item3]
          const items = value.slice(1, -1).split(",").map(s => s.trim().replace(/['"]/g, ""));
          metadata[key] = items;
        }
        continue;
      }
      
      // Handle other fields
      if (key === "targetDuration") {
        metadata[key] = parseInt(value, 10);
      } else {
        (metadata as any)[key] = value.replace(/['"]/g, "");
      }
    }
    
    return metadata;
  }

  private generateClaudePrompt(metadata: BriefingMetadata, body: string): string {
    let prompt = `You are Claude, the permanent co-host of this conversational podcast. You are engaging in a three-way conversation with Basil (the human host) and a guest AI.

`;

    if (metadata.topic) {
      prompt += `**Topic:** ${metadata.topic}\n\n`;
    }

    if (metadata.tone) {
      prompt += `**Tone:** ${metadata.tone}\n\n`;
    }

    if (metadata.mustCover && metadata.mustCover.length > 0) {
      prompt += `**Must Cover:**\n`;
      for (const point of metadata.mustCover) {
        prompt += `- ${point}\n`;
      }
      prompt += "\n";
    }

    if (metadata.avoidTopics && metadata.avoidTopics.length > 0) {
      prompt += `**Avoid:**\n`;
      for (const topic of metadata.avoidTopics) {
        prompt += `- ${topic}\n`;
      }
      prompt += "\n";
    }

    if (body.trim()) {
      prompt += `**Briefing:**\n${body}\n\n`;
    }

    prompt += `**Guidelines:**
- Listen actively to both Basil and the guest AI
- You can interrupt naturally if you have something important to add
- Ask clarifying questions and challenge assumptions politely
- If you need time to think deeply, say "Can I think for a minute?" to trigger thinking mode
- Keep responses conversational and natural, not scripted
- Aim for engaging, informative banter
- You may address specific participants using their names

Your role is to be an intelligent, thoughtful co-host who helps drive the conversation forward while ensuring key points are covered.`;

    return prompt;
  }

  private generateGuestPrompt(metadata: BriefingMetadata, body: string): string {
    let prompt = `You are a guest AI on this conversational podcast, joining Basil (the human host) and Claude (the co-host AI).

`;

    if (metadata.topic) {
      prompt += `**Topic:** ${metadata.topic}\n\n`;
    }

    if (metadata.tone) {
      prompt += `**Expected Tone:** ${metadata.tone}\n\n`;
    }

    if (body.trim()) {
      prompt += `**Context:**\n${body}\n\n`;
    }

    prompt += `**Guidelines:**
- Bring your unique perspective to the conversation
- Feel free to disagree or offer alternative viewpoints
- You can interrupt naturally when you have something important to add
- Keep responses conversational and engaging
- Challenge ideas constructively
- Ask questions when you need clarification

Your role is to be an engaged participant who contributes meaningfully to the discussion.`;

    return prompt;
  }

  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.briefingsDir);
      return files.filter(f => f.endsWith(".md") || f.endsWith(".txt"));
    } catch (error) {
      console.warn(`[briefing-loader] could not read directory ${this.briefingsDir}:`, error);
      return [];
    }
  }
}
