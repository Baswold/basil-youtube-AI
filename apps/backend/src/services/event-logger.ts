import { createWriteStream, WriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import { join } from "node:path";

export type EventType =
  | "session.start"
  | "session.end"
  | "vad.speech-start"
  | "vad.speech-end"
  | "stt.partial"
  | "stt.final"
  | "llm.start"
  | "llm.chunk"
  | "llm.complete"
  | "tts.start"
  | "tts.chunk"
  | "tts.complete"
  | "orb.state-change"
  | "mode.thinking"
  | "mode.normal"
  | "autopilot.toggle"
  | "barge-in"
  | "error";

interface BaseEvent {
  type: EventType;
  timestamp: number;
  sessionId: string;
}

export interface SessionStartEvent extends BaseEvent {
  type: "session.start";
  episodeId: string;
  config: Record<string, any>;
}

export interface SessionEndEvent extends BaseEvent {
  type: "session.end";
  duration: number;
}

export interface VadEvent extends BaseEvent {
  type: "vad.speech-start" | "vad.speech-end";
  speaker: string;
  confidence?: number;
}

export interface SttEvent extends BaseEvent {
  type: "stt.partial" | "stt.final";
  speaker: string;
  text: string;
  confidence?: number;
}

export interface LlmEvent extends BaseEvent {
  type: "llm.start" | "llm.chunk" | "llm.complete";
  speaker: string;
  text?: string;
  model?: string;
  latency?: number;
}

export interface TtsEvent extends BaseEvent {
  type: "tts.start" | "tts.chunk" | "tts.complete";
  speaker: string;
  text?: string;
  audioSize?: number;
}

export interface OrbStateChangeEvent extends BaseEvent {
  type: "orb.state-change";
  speaker: string;
  oldState: string;
  newState: string;
}

export interface ModeEvent extends BaseEvent {
  type: "mode.thinking" | "mode.normal";
  speaker: string;
  duration?: number;
}

export interface AutopilotEvent extends BaseEvent {
  type: "autopilot.toggle";
  enabled: boolean;
}

export interface BargeInEvent extends BaseEvent {
  type: "barge-in";
  interrupter: string;
  interrupted: string[];
}

export interface ErrorEvent extends BaseEvent {
  type: "error";
  error: string;
  stack?: string;
  context?: Record<string, any>;
}

export type LogEvent =
  | SessionStartEvent
  | SessionEndEvent
  | VadEvent
  | SttEvent
  | LlmEvent
  | TtsEvent
  | OrbStateChangeEvent
  | ModeEvent
  | AutopilotEvent
  | BargeInEvent
  | ErrorEvent;

interface EventLoggerConfig {
  outputDir?: string;
  episodeId: string;
}

export class EventLogger {
  private config: EventLoggerConfig;
  private stream?: WriteStream;
  private filePath: string;
  private sessionStartTime: number = 0;

  constructor(config: EventLoggerConfig) {
    this.config = {
      outputDir: "./recordings",
      ...config,
    };
    
    const outputDir = join(this.config.outputDir!, this.config.episodeId);
    this.filePath = join(outputDir, "events.jsonl");
  }

  async start(): Promise<void> {
    const outputDir = join(this.config.outputDir!, this.config.episodeId);
    await fs.mkdir(outputDir, { recursive: true });
    
    this.stream = createWriteStream(this.filePath, { flags: "a" });
    this.sessionStartTime = Date.now();
    
    console.info(`[event-logger] started for episode ${this.config.episodeId}`);
  }

  log(event: Omit<LogEvent, "timestamp">): void {
    if (!this.stream) {
      console.warn("[event-logger] attempted to log before start()");
      return;
    }

    const fullEvent = {
      ...event,
      timestamp: Date.now(),
    } as LogEvent;

    const line = JSON.stringify(fullEvent) + "\n";
    this.stream.write(line);
  }

  async stop(): Promise<void> {
    if (this.stream) {
      await new Promise<void>((resolve) => {
        this.stream!.end(() => {
          console.info(`[event-logger] stopped, wrote to ${this.filePath}`);
          resolve();
        });
      });
    }
  }

  // Convenience methods for common events
  logSessionStart(sessionId: string, episodeId: string, config: Record<string, any>): void {
    this.log({
      type: "session.start",
      sessionId,
      episodeId,
      config,
    } as Omit<SessionStartEvent, "timestamp">);
  }

  logSessionEnd(sessionId: string): void {
    this.log({
      type: "session.end",
      sessionId,
      duration: Date.now() - this.sessionStartTime,
    } as Omit<SessionEndEvent, "timestamp">);
  }

  logVadSpeechStart(sessionId: string, speaker: string, confidence?: number): void {
    this.log({
      type: "vad.speech-start",
      sessionId,
      speaker,
      confidence,
    } as Omit<VadEvent, "timestamp">);
  }

  logVadSpeechEnd(sessionId: string, speaker: string): void {
    this.log({
      type: "vad.speech-end",
      sessionId,
      speaker,
    } as Omit<VadEvent, "timestamp">);
  }

  logSttTranscript(sessionId: string, speaker: string, text: string, isFinal: boolean, confidence?: number): void {
    this.log({
      type: isFinal ? "stt.final" : "stt.partial",
      sessionId,
      speaker,
      text,
      confidence,
    } as Omit<SttEvent, "timestamp">);
  }

  logLlmStart(sessionId: string, speaker: string, model?: string): void {
    this.log({
      type: "llm.start",
      sessionId,
      speaker,
      model,
    } as Omit<LlmEvent, "timestamp">);
  }

  logLlmChunk(sessionId: string, speaker: string, text: string): void {
    this.log({
      type: "llm.chunk",
      sessionId,
      speaker,
      text,
    } as Omit<LlmEvent, "timestamp">);
  }

  logLlmComplete(sessionId: string, speaker: string, latency: number): void {
    this.log({
      type: "llm.complete",
      sessionId,
      speaker,
      latency,
    } as Omit<LlmEvent, "timestamp">);
  }

  logTtsStart(sessionId: string, speaker: string, text: string): void {
    this.log({
      type: "tts.start",
      sessionId,
      speaker,
      text,
    } as Omit<TtsEvent, "timestamp">);
  }

  logTtsComplete(sessionId: string, speaker: string): void {
    this.log({
      type: "tts.complete",
      sessionId,
      speaker,
    } as Omit<TtsEvent, "timestamp">);
  }

  logOrbStateChange(sessionId: string, speaker: string, oldState: string, newState: string): void {
    this.log({
      type: "orb.state-change",
      sessionId,
      speaker,
      oldState,
      newState,
    } as Omit<OrbStateChangeEvent, "timestamp">);
  }

  logThinkingMode(sessionId: string, speaker: string, duration: number): void {
    this.log({
      type: "mode.thinking",
      sessionId,
      speaker,
      duration,
    } as Omit<ModeEvent, "timestamp">);
  }

  logAutopilot(sessionId: string, enabled: boolean): void {
    this.log({
      type: "autopilot.toggle",
      sessionId,
      enabled,
    } as Omit<AutopilotEvent, "timestamp">);
  }

  logBargeIn(sessionId: string, interrupter: string, interrupted: string[]): void {
    this.log({
      type: "barge-in",
      sessionId,
      interrupter,
      interrupted,
    } as Omit<BargeInEvent, "timestamp">);
  }

  logError(sessionId: string, error: Error, context?: Record<string, any>): void {
    this.log({
      type: "error",
      sessionId,
      error: error.message,
      stack: error.stack,
      context,
    } as Omit<ErrorEvent, "timestamp">);
  }
}
