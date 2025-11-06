import type { SpeakerId } from "@basil/shared";

export interface SttAdapter {
  start(sessionId: string): Promise<void>;
  stop(sessionId: string): Promise<void>;
  sendAudio?(sessionId: string, audioChunk: Buffer): void;
}

export interface TtsAdapter {
  synthesize(sessionId: string, text: string): Promise<void>;
  stop(sessionId: string): Promise<void>;
}

export interface LlmAdapter {
  readonly id: string;
  generate(sessionId: string, prompt: string): AsyncIterable<string>;
  stop(sessionId: string): Promise<void>;
}

export interface AdapterFactory {
  stt(): SttAdapter;
  tts(speaker?: Exclude<SpeakerId, "you">): TtsAdapter;
  llm(identifier: "claude" | "guest"): LlmAdapter;
}
