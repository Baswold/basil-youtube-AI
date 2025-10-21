import { setTimeout as delay } from "node:timers/promises";
import type { AdapterFactory, LlmAdapter, SttAdapter, TtsAdapter } from "./interfaces";

class MockStt implements SttAdapter {
  async start(sessionId: string): Promise<void> {
    console.info(`[mock-stt] starting stream for ${sessionId}`);
  }

  async stop(sessionId: string): Promise<void> {
    console.info(`[mock-stt] stopping stream for ${sessionId}`);
  }
}

class MockTts implements TtsAdapter {
  async synthesize(sessionId: string, text: string): Promise<void> {
    console.info(`[mock-tts] ${sessionId} -> ${text}`);
    await delay(10);
  }

  async stop(sessionId: string): Promise<void> {
    console.info(`[mock-tts] stopping ${sessionId}`);
  }
}

class MockLlm implements LlmAdapter {
  constructor(readonly id: string) {}

  async *generate(_sessionId: string, prompt: string): AsyncIterable<string> {
    yield `mock-response(${this.id}): ${prompt.slice(0, 40)}...`;
  }

  async stop(sessionId: string): Promise<void> {
    console.info(`[mock-llm/${this.id}] stop called for ${sessionId}`);
  }
}

export class MockAdapterFactory implements AdapterFactory {
  stt(): SttAdapter {
    return new MockStt();
  }

  tts(): TtsAdapter {
    return new MockTts();
  }

  llm(identifier: "claude" | "guest"): LlmAdapter {
    return new MockLlm(identifier);
  }
}
