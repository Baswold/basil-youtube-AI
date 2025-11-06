"use client";

import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import type {
  CaptionPayload,
  ClientToServerEvents,
  OrchestratorStateSnapshot,
  ServerToClientEvents,
  SpeakerId,
  OrbState,
  SharedScreenState,
} from "@basil/shared";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface StudioState {
  connection: ConnectionStatus;
  autopilot: boolean;
  orbStates: Record<SpeakerId, OrbState>;
  captions: CaptionPayload[];
  sharedScreen: SharedScreenState;
  connect: () => void;
  toggleAutopilot: () => void;
  lastAck?: string;
}

const defaultOrbState: Record<SpeakerId, OrbState> = {
  you: "idle",
  claude: "idle",
  guest: "idle",
};

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export const useStudioStore = create<StudioState>((set, get) => ({
  connection: "idle",
  autopilot: false,
  orbStates: { ...defaultOrbState },
  captions: [],
  sharedScreen: { mode: "conversation" },
  connect: () => {
    if (typeof window === "undefined") return;

    if (!socket) {
      set({ connection: "connecting" });

      socket = io(backendUrl, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.on("connect", () => {
        set({ connection: "connected" });
        socket?.emit("hello", { participantName: "frontend" });
        socket?.emit("client.request-state");
      });

      socket.on("connect_error", (err) => {
        console.error("Socket connection error", err);
        set({ connection: "error" });
      });

      socket.on("disconnect", () => {
        set({ connection: "idle" });
      });

      socket.on("reconnect", (attemptNumber) => {
        console.log(`Reconnected after ${attemptNumber} attempts`);
        set({ connection: "connected" });
        socket?.emit("hello", { participantName: "frontend" });
        socket?.emit("client.request-state");
      });

      socket.on("server.ack", (message) => {
        set({ lastAck: message });
      });

      socket.on("state.snapshot", (snapshot: OrchestratorStateSnapshot) => {
        set({
          autopilot: snapshot.autopilot,
          orbStates: snapshot.orbStates,
          captions: snapshot.captions,
          sharedScreen: snapshot.sharedScreen,
        });
      });

      socket.on("orb.state", (speaker, state) => {
        set((prev) => ({
          orbStates: { ...prev.orbStates, [speaker]: state },
        }));
      });

      socket.on("caption", (payload) => {
        set((prev) => ({
          captions: [payload, ...prev.captions].slice(0, 5),
        }));
      });

      socket.on("mode.thinking", (payload) => {
        set((prev) => ({
          captions: [
            {
              id: payload.startedAt.toString(),
              speaker: payload.speaker,
              text: `thinking for ${Math.round(payload.durationMs / 1000)} seconds...`,
              timestamp: payload.startedAt,
            },
            ...prev.captions,
          ].slice(0, 5),
          sharedScreen: {
            mode: "thinking",
            thinking: {
              speaker: payload.speaker,
              durationMs: payload.durationMs,
              startedAt: payload.startedAt,
              endsAt: payload.startedAt + payload.durationMs,
            },
          },
        }));
      });

      socket.on("mode.normal", () => {
        set((prev) => ({
          sharedScreen:
            prev.sharedScreen.mode === "thinking"
              ? { mode: "conversation" }
              : prev.sharedScreen,
        }));
      });

      socket.on("shared-screen.state", (state) => {
        set({ sharedScreen: state });
      });
    } else if (socket.disconnected) {
      set({ connection: "connecting" });
      socket.connect();
    }
  },
  toggleAutopilot: () => {
    const current = get().autopilot;
    socket?.emit("client.toggle-autopilot", !current);
    set({ autopilot: !current });
  },
}));

export function getSocket() {
  return socket;
}
