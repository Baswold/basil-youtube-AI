export type SpeakerId = "you" | "claude" | "guest";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "muted" | "error";

export interface CaptionPayload {
  id: string;
  speaker: SpeakerId;
  text: string;
  timestamp: number;
}

export interface ModeThinkingPayload {
  speaker: SpeakerId;
  durationMs: number;
  startedAt: number;
}

export interface ModeNormalPayload {
  speaker: SpeakerId;
  endedAt: number;
}

export type SharedScreenMode = "conversation" | "thinking";

export interface SharedScreenThinkingState {
  speaker: SpeakerId;
  durationMs: number;
  startedAt: number;
  endsAt: number;
}

export interface SharedScreenState {
  mode: SharedScreenMode;
  thinking?: SharedScreenThinkingState;
}

export interface RecordingReadyPayload {
  episodeId: string;
  files: string[];
}

export interface ClientHelloPayload {
  episodeId?: string;
  participantName?: string;
}

export interface OrchestratorStateSnapshot {
  orbStates: Record<SpeakerId, OrbState>;
  captions: CaptionPayload[];
  autopilot: boolean;
  sharedScreen: SharedScreenState;
}

export interface ClientToServerEvents {
  hello(payload: ClientHelloPayload): void;
  "audio.chunk"(chunk: ArrayBuffer): void;
  "client.toggle-autopilot"(on: boolean): void;
  "client.request-state"(): void;
}

export interface ServerToClientEvents {
  "orb.state"(speaker: SpeakerId, state: OrbState): void;
  caption(payload: CaptionPayload): void;
  "mode.thinking"(payload: ModeThinkingPayload): void;
  "mode.normal"(payload: ModeNormalPayload): void;
  "recording.ready"(payload: RecordingReadyPayload): void;
  "server.ack"(message: string): void;
  "state.snapshot"(snapshot: OrchestratorStateSnapshot): void;
  "shared-screen.state"(state: SharedScreenState): void;
}

// Persona and configuration types
export * from "./persona-types";
