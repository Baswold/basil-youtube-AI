import Anthropic from "@anthropic-ai/sdk";
import type { LlmAdapter } from "./interfaces";

interface ClaudeConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class ClaudeAdapter implements LlmAdapter {
  readonly id = "claude";
  private client: Anthropic;
  private config: ClaudeConfig;
  private activeStreams = new Map<string, AbortController>();

  constructor(config: ClaudeConfig) {
    this.config = {
      model: "claude-3-5-haiku-20241022",
      maxTokens: 2048,
      temperature: 0.7,
      ...config,
    };
    this.client = new Anthropic({
      apiKey: this.config.apiKey,
    });
  }

  async *generate(sessionId: string, prompt: string): AsyncIterable<string> {
    const controller = new AbortController();
    this.activeStreams.set(sessionId, controller);

    try {
      const stream = await this.client.messages.create(
        {
          model: this.config.model!,
          max_tokens: this.config.maxTokens!,
          temperature: this.config.temperature,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          stream: true,
        },
        {
          signal: controller.signal,
        }
      );

      for await (const event of stream) {
        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            yield event.delta.text;
          }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.info(`[claude] generation stopped for ${sessionId}`);
      } else {
        console.error(`[claude] error for ${sessionId}:`, error);
        throw error;
      }
    } finally {
      this.activeStreams.delete(sessionId);
    }
  }

  async stop(sessionId: string): Promise<void> {
    const controller = this.activeStreams.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(sessionId);
    }
  }
}
