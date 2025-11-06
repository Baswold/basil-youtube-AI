import OpenAI from "openai";
import type { LlmAdapter } from "./interfaces";

interface OpenAICompatibleConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export class OpenAICompatibleAdapter implements LlmAdapter {
  readonly id: string;
  private client: OpenAI;
  private config: OpenAICompatibleConfig;
  private activeStreams = new Map<string, AbortController>();

  constructor(id: string, config: OpenAICompatibleConfig) {
    this.id = id;
    this.config = {
      maxTokens: 2048,
      temperature: 0.7,
      ...config,
    };
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
    });
  }

  async *generate(sessionId: string, prompt: string): AsyncIterable<string> {
    const controller = new AbortController();
    this.activeStreams.set(sessionId, controller);

    try {
      const stream = await this.client.chat.completions.create(
        {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
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

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.info(`[${this.id}] generation stopped for ${sessionId}`);
      } else {
        console.error(`[${this.id}] error for ${sessionId}:`, error);
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

// Preset factory functions for common providers
export function createGroqAdapter(apiKey: string, model = "llama-3.3-70b-versatile"): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter("groq", {
    apiKey,
    baseUrl: "https://api.groq.com/openai/v1",
    model,
  });
}

export function createTogetherAdapter(apiKey: string, model = "meta-llama/Llama-3-70b-chat-hf"): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter("together", {
    apiKey,
    baseUrl: "https://api.together.xyz/v1",
    model,
  });
}

export function createGrokAdapter(apiKey: string, model = "grok-beta"): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter("grok", {
    apiKey,
    baseUrl: "https://api.x.ai/v1",
    model,
  });
}

export function createLocalLlamaAdapter(baseUrl = "http://localhost:8080/v1", model = "local-model"): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter("local", {
    apiKey: "not-needed",
    baseUrl,
    model,
  });
}
