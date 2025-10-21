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
import { RealAdapterFactory, type FactoryConfig } from "./adapters/factory.js";
import { RecorderService } from "./services/recorder.js";
import { EventLogger } from "./services/event-logger.js";
import { BriefingLoader } from "./services/briefing-loader.js";

interface OrchestratorConfig {
  useRealAdapters?: boolean;
  episodeId?: string;
  briefingPath?: string;
  recordingDir?: string;
}

export class ProductionOrchestrator {
  private autopilot = false;
  private orbStates: Record<SpeakerId, OrbState> = {
    you: "idle",
    claude: "idle",
    guest: "idle",
  };
  private captions: CaptionPayload[] = [];
  private config: OrchestratorConfig;
  private adapterFactory: RealAdapterFactory;
  private recorder?: RecorderService;
  private eventLogger?: EventLogger;
  private briefingLoader: BriefingLoader;
  private activeSessions = new Map<string, SessionContext>();

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      useRealAdapters: process.env.USE_REAL_ADAPTERS === "true",
      episodeId: config.episodeId || `episode-${Date.now()}`,
      briefingPath: config.briefingPath,
      recordingDir: config.recordingDir || "./recordings",
    };

    // Initialize adapter factory
    const factoryConfig: FactoryConfig = {
      onSttTranscript: this.handleSttTranscript.bind(this),
      onSttError: this.handleSttError.bind(this),
      onTtsAudioChunk: this.handleTtsAudioChunk.bind(this),
      onTtsComplete: this.handleTtsComplete.bind(this),
      onTtsError: this.handleTtsError.bind(this),
    };

    this.adapterFactory = new RealAdapterFactory(factoryConfig);
    this.briefingLoader = new BriefingLoader();

    console.info(`[orchestrator] initialized with episode: ${this.config.episodeId}`);
  }

  async register(socket: Socket<ClientToServerEvents, ServerToClientEvents>): Promise<void> {
    const sessionId = socket.id;
    console.info(`[orchestrator] registering session ${sessionId}`);

    try {
      // Create session context
      const context = await this.createSession(sessionId, socket);
      this.activeSessions.set(sessionId, context);

      // Send initial state
      socket.emit("server.ack", "connected");
      socket.emit("state.snapshot", this.snapshot());

      // Set up event handlers
      this.setupSocketHandlers(socket, context);

      console.info(`[orchestrator] session ${sessionId} registered successfully`);
    } catch (error) {
      console.error(`[orchestrator] failed to register session ${sessionId}:`, error);
      socket.emit("server.ack", `error: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  private async createSession(
    sessionId: string,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ): Promise<SessionContext> {
    // Initialize event logger
    const eventLogger = new EventLogger({
      episodeId: this.config.episodeId!,
      outputDir: this.config.recordingDir,
    });
    await eventLogger.start();
    eventLogger.logSessionStart(sessionId, this.config.episodeId!, {
      useRealAdapters: this.config.useRealAdapters,
      briefingPath: this.config.briefingPath,
    });

    // Initialize recorder
    const recorder = new RecorderService({
      episodeId: this.config.episodeId!,
      outputDir: this.config.recordingDir,
    });
    await recorder.start();

    // Load briefing if provided
    let briefing;
    if (this.config.briefingPath) {
      try {
        briefing = await this.briefingLoader.load(this.config.briefingPath);
        console.info(`[orchestrator] loaded briefing: ${briefing.metadata.title || "untitled"}`);
      } catch (error) {
        console.warn(`[orchestrator] failed to load briefing:`, error);
      }
    }

    return {
      sessionId,
      socket,
      eventLogger,
      recorder,
      briefing,
      isRecording: false,
      isSpeaking: false,
    };
  }

  private setupSocketHandlers(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    context: SessionContext
  ): void {
    const { sessionId, eventLogger } = context;

    socket.on("hello", async (payload) => {
      const participant = payload.participantName ?? "anonymous";
      console.info(`[orchestrator] hello from ${participant}`);
      
      socket.emit("server.ack", `hello ${participant}`);
      eventLogger.log({
        type: "session.start",
        sessionId,
        episodeId: payload.episodeId || this.config.episodeId!,
        config: { participant },
      } as any);
    });

    socket.on("audio.chunk", async (chunk) => {
      try {
        await this.handleAudioChunk(sessionId, chunk);
      } catch (error) {
        console.error(`[orchestrator] error handling audio chunk:`, error);
        eventLogger.logError(sessionId, error as Error, { event: "audio.chunk" });
      }
    });

    socket.on("client.toggle-autopilot", (on) => {
      this.autopilot = on;
      console.info(`[orchestrator] autopilot ${on ? "enabled" : "disabled"}`);
      
      socket.emit("server.ack", `autopilot ${on ? "enabled" : "disabled"}`);
      socket.emit("state.snapshot", this.snapshot());
      
      eventLogger.logAutopilot(sessionId, on);
    });

    socket.on("client.request-state", () => {
      socket.emit("state.snapshot", this.snapshot());
    });

    socket.on("disconnect", async () => {
      console.info(`[orchestrator] session ${sessionId} disconnecting`);
      await this.cleanupSession(sessionId);
    });
  }

  private async handleAudioChunk(sessionId: string, chunk: ArrayBuffer): Promise<void> {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    const buffer = Buffer.from(chunk);
    
    // Send to STT if available
    // For now, this is a placeholder - will be wired when STT is fully integrated
    
    // Record audio (for "you" speaker)
    await context.recorder.writeAudioChunk("you", buffer);
  }

  private handleSttTranscript(sessionId: string, text: string, isFinal: boolean): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    console.info(`[orchestrator] STT (${isFinal ? "final" : "partial"}): ${text}`);

    if (isFinal) {
      const caption: CaptionPayload = {
        id: randomUUID(),
        speaker: "you",
        text,
        timestamp: Date.now(),
      };

      this.addCaption(caption);
      context.socket.emit("caption", caption);
      context.recorder.addCaption("you", text);
      context.eventLogger.logSttTranscript(sessionId, "you", text, true);

      // Update orb state
      this.updateOrbState("you", "listening", context.socket);
    }
  }

  private handleSttError(sessionId: string, error: Error): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    console.error(`[orchestrator] STT error for ${sessionId}:`, error);
    context.eventLogger.logError(sessionId, error, { service: "stt" });
    context.socket.emit("server.ack", `stt error: ${error.message}`);
  }

  private handleTtsAudioChunk(sessionId: string, audioChunk: Buffer): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    // Determine which speaker is currently speaking
    // This will be tracked in session context
    const speaker: SpeakerId = "claude"; // Placeholder
    context.recorder.writeAudioChunk(speaker, audioChunk);
  }

  private handleTtsComplete(sessionId: string): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    console.info(`[orchestrator] TTS complete for ${sessionId}`);
    context.eventLogger.logTtsComplete(sessionId, "claude");
  }

  private handleTtsError(sessionId: string, error: Error): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    console.error(`[orchestrator] TTS error for ${sessionId}:`, error);
    context.eventLogger.logError(sessionId, error, { service: "tts" });
  }

  private addCaption(caption: CaptionPayload): void {
    this.captions = [caption, ...this.captions].slice(0, 20);
  }

  private updateOrbState(
    speaker: SpeakerId,
    state: OrbState,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ): void {
    const oldState = this.orbStates[speaker];
    this.orbStates[speaker] = state;
    socket.emit("orb.state", speaker, state);

    const context = Array.from(this.activeSessions.values())[0];
    if (context) {
      context.eventLogger.logOrbStateChange(context.sessionId, speaker, oldState, state);
    }
  }

  private async cleanupSession(sessionId: string): Promise<void> {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    try {
      // Stop recording and save files
      const files = await context.recorder.stop();
      console.info(`[orchestrator] recording stopped, files: ${files.join(", ")}`);
      
      context.socket.emit("recording.ready", { files });

      // Stop event logger
      context.eventLogger.logSessionEnd(sessionId);
      await context.eventLogger.stop();

      this.activeSessions.delete(sessionId);
      console.info(`[orchestrator] session ${sessionId} cleaned up`);
    } catch (error) {
      console.error(`[orchestrator] error cleaning up session ${sessionId}:`, error);
    }
  }

  private snapshot(): OrchestratorStateSnapshot {
    return {
      orbStates: { ...this.orbStates },
      captions: [...this.captions].slice(0, 6),
      autopilot: this.autopilot,
    };
  }

  async shutdown(): Promise<void> {
    console.info("[orchestrator] shutting down...");
    
    for (const [sessionId, _] of this.activeSessions) {
      await this.cleanupSession(sessionId);
    }

    console.info("[orchestrator] shutdown complete");
  }
}

interface SessionContext {
  sessionId: string;
  socket: Socket<ClientToServerEvents, ServerToClientEvents>;
  eventLogger: EventLogger;
  recorder: RecorderService;
  briefing?: any;
  isRecording: boolean;
  isSpeaking: boolean;
}
