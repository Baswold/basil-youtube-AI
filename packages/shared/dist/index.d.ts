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
    "recording.ready"(payload: RecordingReadyPayload): void;
    "server.ack"(message: string): void;
    "state.snapshot"(snapshot: OrchestratorStateSnapshot): void;
}
export * from "./persona-types";
