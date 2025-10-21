import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io";
import type {
  CaptionPayload,
  ClientToServerEvents,
  ModeThinkingPayload,
  OrchestratorStateSnapshot,
  OrbState,
  ServerToClientEvents,
  SpeakerId,
} from "@basil/shared";
import { MockAdapterFactory } from "./adapters/mock.js";
import type { SttAdapter } from "./adapters/interfaces.js";

const SPEAKERS: SpeakerId[] = ["you", "claude", "guest"];
const ORB_STATES: OrbState[] = ["idle", "listening", "speaking", "thinking"];

export class Orchestrator {
  private autopilot = false;
  private orbStates: Record<SpeakerId, OrbState> = {
    you: "idle",
    claude: "idle",
    guest: "idle",
  };
  private captions: CaptionPayload[] = [];
  private readonly adapters = new MockAdapterFactory();

  register(socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
    const pump = new MockConversationPump(
      socket,
      () => this.autopilot,
      (speaker, state) => {
        this.orbStates[speaker] = state;
      },
      (caption) => {
        this.captions = [caption, ...this.captions].slice(0, 6);
      },
    );
    const sttSession: SttAdapter = this.adapters.stt();

    socket.emit("server.ack", "connected");
    socket.emit("state.snapshot", this.snapshot());

    socket.on("hello", (payload) => {
      const participant = payload.participantName ?? "anonymous";
      socket.emit("server.ack", `hello ${participant}`);
      sttSession.start(socket.id).catch((err) => {
        console.error("failed to start mock stt", err);
      });
    });

    socket.on("client.toggle-autopilot", (on) => {
      this.autopilot = on;
      socket.emit("server.ack", `autopilot ${on ? "enabled" : "disabled"}`);
      socket.emit("state.snapshot", this.snapshot());
    });

    socket.on("client.request-state", () => {
      socket.emit("state.snapshot", this.snapshot());
    });

    socket.on("disconnect", () => {
      sttSession.stop(socket.id).catch((err) => console.error(err));
      pump.dispose();
    });

    pump.start();
  }

  private snapshot(): OrchestratorStateSnapshot {
    return {
      orbStates: { ...this.orbStates },
      captions: [...this.captions],
      autopilot: this.autopilot,
    };
  }
}

class MockConversationPump {
  private orbTimer?: NodeJS.Timeout;
  private captionTimer?: NodeJS.Timeout;
  private thinkingTimer?: NodeJS.Timeout;

  constructor(
    private readonly socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    private readonly getAutopilot: () => boolean,
    private readonly onOrbState: (speaker: SpeakerId, state: OrbState) => void,
    private readonly onCaption: (caption: CaptionPayload) => void,
  ) {}

  start(): void {
    this.orbTimer = setInterval(() => {
      const speaker = pickRandom(SPEAKERS);
      const state = pickRandom(ORB_STATES);
      this.onOrbState(speaker, state);
      this.socket.emit("orb.state", speaker, state);
    }, 2500);

    this.captionTimer = setInterval(() => {
      const speaker = pickRandom(SPEAKERS);
      if (speaker === "you" && this.getAutopilot()) {
        return; // human muted during autopilot demo
      }
      const payload: CaptionPayload = {
        id: randomUUID(),
        speaker,
        text: mockLineFor(speaker),
        timestamp: Date.now(),
      };
      this.onCaption(payload);
      this.socket.emit("caption", payload);
    }, 4000);

    this.thinkingTimer = setInterval(() => {
      const speaker: SpeakerId = "claude";
      const durationMs = 7500;
      const payload: ModeThinkingPayload = {
        speaker,
        durationMs,
        startedAt: Date.now(),
      };
      this.socket.emit("mode.thinking", payload);
    }, 15000);
  }

  dispose(): void {
    if (this.orbTimer) clearInterval(this.orbTimer);
    if (this.captionTimer) clearInterval(this.captionTimer);
    if (this.thinkingTimer) clearInterval(this.thinkingTimer);
  }
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function mockLineFor(speaker: SpeakerId): string {
  const lines: Record<SpeakerId, string[]> = {
    you: [
      "So walk me through that latency claim again.",
      "I want to press on the privacy angle here.",
      "Let's mark this for post-production notes.",
    ],
    claude: [
      "That's fascinating because it mirrors the lab results.",
      "Give me thirty seconds and I'll synthesize the benchmarks.",
      "I'd love to steelman the opposing view for a moment.",
    ],
    guest: [
      "Edge deployments shine once you hit scale in the field.",
      "Benchmarks without context are marketing, not science.",
      "I have receipts showing the opposite conclusion.",
    ],
  };
  const options = lines[speaker];
  return options[Math.floor(Math.random() * options.length)];
}
