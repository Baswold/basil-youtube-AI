import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io";
import type {
  CaptionPayload,
  ClientToServerEvents,
  ModeNormalPayload,
  ModeThinkingPayload,
  OrchestratorStateSnapshot,
  OrbState,
  ServerToClientEvents,
  SharedScreenState,
  SpeakerId,
} from "@basil/shared";
import { RealAdapterFactory, type FactoryConfig } from "./adapters/factory.js";
import { RecorderService } from "./services/recorder.js";
import { EventLogger } from "./services/event-logger.js";
import { BriefingLoader } from "./services/briefing-loader.js";
import type { TtsAdapter } from "./adapters/interfaces.js";
import { VadDetector } from "./services/vad-detector.js";
import { CommandRouter, type CommandRouteResult } from "./services/command-router.js";

/**
 * Audio ducking configuration constants
 * Ducking reduces agent audio volume when the human speaker is detected
 */
const DUCKING_DB_REDUCTION = -12; // Reduce agent volume by 12 decibels
const DEFAULT_THINKING_DURATION_MS = 30_000; // 30 seconds default thinking time
const MAX_CAPTION_HISTORY = 20; // Maximum number of captions to keep in memory
const CAPTION_SNAPSHOT_LIMIT = 6; // Number of captions to include in state snapshots

/**
 * Configuration options for the ProductionOrchestrator
 */
interface OrchestratorConfig {
  /** Whether to use real external adapters (STT/TTS/LLM) or mocks */
  useRealAdapters?: boolean;
  /** Unique identifier for the current episode/session */
  episodeId?: string;
  /** Path to the briefing markdown file */
  briefingPath?: string;
  /** Directory where recordings and logs are stored */
  recordingDir?: string;
}

/**
 * Agent speaker types (excludes human "you" speaker)
 */
type AgentSpeaker = Extract<SpeakerId, "claude" | "guest">;

/**
 * ProductionOrchestrator manages the three-way conversation between Basil (human),
 * Claude AI, and a guest AI. It handles:
 * - WebSocket session management
 * - Voice Activity Detection (VAD) for barge-in/interruption
 * - Audio ducking (reducing agent volume when human speaks)
 * - Command routing (addressing specific agents)
 * - Thinking mode (shared screen state for agent reflection)
 * - Recording and event logging
 */
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
  private sharedScreen: SharedScreenState = { mode: "conversation" };
  private thinkingTimer?: NodeJS.Timeout;
  /**
   * Gain multiplier for audio ducking
   * Converts decibels to linear gain: 10^(dB/20)
   * -12 dB = 0.251 (approximately 25% volume)
   */
  private duckingGain = Math.pow(10, DUCKING_DB_REDUCTION / 20);

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

  /**
   * Registers a new WebSocket client session
   * Creates session context, initializes services, and sets up event handlers
   *
   * @param socket - Socket.IO socket connection from the client
   */
  async register(socket: Socket<ClientToServerEvents, ServerToClientEvents>): Promise<void> {
    const sessionId = socket.id;
    console.info(`[orchestrator] registering session ${sessionId}`);

    try {
      // Create session context with recorder, event logger, and VAD
      const context = await this.createSession(sessionId, socket);
      this.activeSessions.set(sessionId, context);

      // Send initial state to client
      socket.emit("server.ack", "connected");
      socket.emit("state.snapshot", this.snapshot());

      // Set up event handlers for client messages
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

    const vad = new VadDetector({
      onSpeechStart: () => this.handleHumanSpeechStart(sessionId),
      onSpeechEnd: () => this.handleHumanSpeechEnd(sessionId),
    });

    const commandRouter = new CommandRouter();

    const resolveAdapter = async <T>(adapter: T | Promise<T>): Promise<T> => {
      if (adapter && typeof (adapter as any).then === "function") {
        return await (adapter as unknown as Promise<T>);
      }
      return adapter as T;
    };

    let claudeTts: TtsAdapter | undefined;
    let guestTts: TtsAdapter | undefined;

    if (this.config.useRealAdapters) {
      try {
        claudeTts = await resolveAdapter(this.adapterFactory.tts("claude") as any);
      } catch (error) {
        console.warn("[orchestrator] failed to initialize Claude TTS adapter", error);
      }

      try {
        guestTts = await resolveAdapter(this.adapterFactory.tts("guest") as any);
      } catch (error) {
        console.warn("[orchestrator] failed to initialize guest TTS adapter", error);
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
      vad,
      commandRouter,
      ttsAdapters: {
        claude: claudeTts,
        guest: guestTts,
      },
      activeAgentSpeakers: new Set<AgentSpeaker>(),
      duckingActive: false,
      humanSpeaking: false,
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

    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : chunk);
    
    context.vad.processAudio(buffer);
    
    // Send to STT if available
    // For now, this is a placeholder - will be wired when STT is fully integrated
    
    // Record audio (for "you" speaker)
    await context.recorder.writeAudioChunk("you", buffer);
  }

  /**
   * Handles the start of human speech detected by VAD
   * Implements barge-in: interrupts agent playback and activates audio ducking
   *
   * @param sessionId - Session identifier
   */
  private handleHumanSpeechStart(sessionId: string): void {
    const context = this.activeSessions.get(sessionId);
    if (!context || context.humanSpeaking) return;

    // Mark human as speaking and activate ducking
    context.humanSpeaking = true;
    context.duckingActive = true;
    context.eventLogger.logVadSpeechStart(sessionId, "you");

    // Barge-in: Stop any currently speaking agents
    const interrupted = Array.from(context.activeAgentSpeakers);
    if (interrupted.length > 0) {
      context.eventLogger.logBargeIn(sessionId, "you", interrupted);
      for (const speaker of interrupted) {
        void this.stopAgentPlayback(context, speaker);
      }
      context.activeAgentSpeakers.clear();
    }

    // Save current orb states for restoration later
    context.orbRestore = {
      claude: this.orbStates.claude,
      guest: this.orbStates.guest,
    };

    // Update orb visualizations
    this.updateOrbState("you", "speaking", context);
    for (const agent of ["claude", "guest"] as AgentSpeaker[]) {
      this.updateOrbState(agent, "muted", context);
    }
  }

  /**
   * Handles the end of human speech detected by VAD
   * Deactivates ducking and restores agent orb states
   *
   * @param sessionId - Session identifier
   */
  private handleHumanSpeechEnd(sessionId: string): void {
    const context = this.activeSessions.get(sessionId);
    if (!context || !context.humanSpeaking) return;

    // Mark human as done speaking and deactivate ducking
    context.humanSpeaking = false;
    context.duckingActive = false;
    context.eventLogger.logVadSpeechEnd(sessionId, "you");

    // Return human orb to listening state
    this.updateOrbState("you", "listening", context);

    // Restore agent orb states to their previous state (before barge-in)
    const restore = context.orbRestore;
    if (restore) {
      for (const agent of ["claude", "guest"] as AgentSpeaker[]) {
        const previous = restore[agent];
        this.updateOrbState(agent, previous ?? "listening", context);
      }
      context.orbRestore = undefined;
    } else {
      // No saved state, default to listening
      for (const agent of ["claude", "guest"] as AgentSpeaker[]) {
        this.updateOrbState(agent, "listening", context);
      }
    }
  }

  private handleCommand(context: SessionContext, command: CommandRouteResult): void {
    context.lastCommand = command;
    context.eventLogger.logCommandRoute(context.sessionId, command);

    switch (command.action) {
      case "thinking":
        this.enterThinkingMode(context, command);
        break;
      case "address": {
        const targets = new Set<AgentSpeaker>(command.targets as AgentSpeaker[]);
        context.pendingTargets = targets;
        context.socket.emit("server.ack", `routing to ${Array.from(targets).join(", ")}`);
        break;
      }
      default:
        context.pendingTargets = undefined;
        break;
    }
  }

  /**
   * Enters thinking mode where an agent pauses to reflect before responding
   * Updates shared screen, sets orb states, and starts countdown timer
   */
  private enterThinkingMode(context: SessionContext, command: CommandRouteResult): void {
    const speaker = (command.targets[0] as AgentSpeaker) || "claude";
    const durationMs = command.durationMs ?? DEFAULT_THINKING_DURATION_MS;
    const startedAt = Date.now();
    const endsAt = startedAt + durationMs;

    if (this.thinkingTimer) {
      clearTimeout(this.thinkingTimer);
    }

    this.sharedScreen = {
      mode: "thinking",
      thinking: {
        speaker,
        durationMs,
        startedAt,
        endsAt,
      },
    };

    const payload: ModeThinkingPayload = {
      speaker,
      durationMs,
      startedAt,
    };

    this.broadcastSharedScreen();

    for (const session of this.activeSessions.values()) {
      session.socket.emit("mode.thinking", payload);
    }

    this.updateOrbState(speaker, "thinking", context);
    for (const other of ["claude", "guest"] as AgentSpeaker[]) {
      if (other !== speaker) {
        this.updateOrbState(other, "muted", context);
      }
    }

    context.eventLogger.logThinkingMode(context.sessionId, speaker, durationMs);

    this.thinkingTimer = setTimeout(() => {
      this.exitThinkingMode(context, speaker);
    }, durationMs);
  }

  private exitThinkingMode(context: SessionContext, speaker: AgentSpeaker): void {
    if (this.sharedScreen.mode !== "thinking") {
      return;
    }

    if (this.thinkingTimer) {
      clearTimeout(this.thinkingTimer);
      this.thinkingTimer = undefined;
    }

    this.sharedScreen = { mode: "conversation" };
    this.broadcastSharedScreen();

    const payload: ModeNormalPayload = {
      speaker,
      endedAt: Date.now(),
    };

    for (const session of this.activeSessions.values()) {
      session.socket.emit("mode.normal", payload);
    }

    for (const agent of ["claude", "guest"] as AgentSpeaker[]) {
      this.updateOrbState(agent, "listening", context);
    }
  }

  private broadcastSharedScreen(): void {
    for (const session of this.activeSessions.values()) {
      session.socket.emit("shared-screen.state", this.sharedScreen);
    }
  }

  private async stopAgentPlayback(context: SessionContext, speaker: AgentSpeaker): Promise<void> {
    const adapter = context.ttsAdapters[speaker];
    if (!adapter) return;

    try {
      await adapter.stop(context.sessionId);
    } catch (error) {
      console.warn(`[orchestrator] failed to stop TTS for ${speaker}`, error);
    }

    context.activeAgentSpeakers.delete(speaker);

    if (!context.humanSpeaking) {
      this.updateOrbState(speaker, "listening", context);
    }
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
      this.updateOrbState("you", "listening", context);

      const command = context.commandRouter.route(text);
      if (command) {
        this.handleCommand(context, command);
      }
    }
  }

  private handleSttError(sessionId: string, error: Error): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    console.error(`[orchestrator] STT error for ${sessionId}:`, error);
    context.eventLogger.logError(sessionId, error, { service: "stt" });
    context.socket.emit("server.ack", `stt error: ${error.message}`);
  }

  private handleTtsAudioChunk(sessionId: string, speaker: AgentSpeaker, audioChunk: Buffer): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    const processedChunk = context.duckingActive ? this.applyGain(audioChunk, this.duckingGain) : audioChunk;
    context.recorder.writeAudioChunk(speaker, processedChunk);

    if (!context.activeAgentSpeakers.has(speaker)) {
      context.activeAgentSpeakers.add(speaker);
      context.eventLogger.logTtsStart(sessionId, speaker, context.lastCommand?.remainder ?? "");
      this.updateOrbState(speaker, "speaking", context);
    }

    context.eventLogger.logTtsChunk(sessionId, speaker, processedChunk.length);
  }

  private handleTtsComplete(sessionId: string, speaker: AgentSpeaker): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    console.info(`[orchestrator] TTS complete for ${sessionId} (${speaker})`);
    context.eventLogger.logTtsComplete(sessionId, speaker);
    context.activeAgentSpeakers.delete(speaker);

    if (!context.humanSpeaking) {
      this.updateOrbState(speaker, "listening", context);
    }
  }

  private handleTtsError(sessionId: string, speaker: AgentSpeaker, error: Error): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    console.error(`[orchestrator] TTS error for ${sessionId} (${speaker}):`, error);
    context.eventLogger.logError(sessionId, error, { service: "tts", speaker });
    context.activeAgentSpeakers.delete(speaker);
  }

  /**
   * Adds a caption to the history, maintaining a rolling window of recent captions
   */
  private addCaption(caption: CaptionPayload): void {
    this.captions = [caption, ...this.captions].slice(0, MAX_CAPTION_HISTORY);
  }

  private updateOrbState(
    speaker: SpeakerId,
    state: OrbState,
    context: SessionContext
  ): void {
    const oldState = this.orbStates[speaker];
    if (oldState === state) return;

    this.orbStates[speaker] = state;

    for (const session of this.activeSessions.values()) {
      session.socket.emit("orb.state", speaker, state);
    }

    context.eventLogger.logOrbStateChange(context.sessionId, speaker, oldState, state);
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

    if (this.activeSessions.size === 0) {
      if (this.thinkingTimer) {
        clearTimeout(this.thinkingTimer);
        this.thinkingTimer = undefined;
      }
      this.sharedScreen = { mode: "conversation" };
    }
  }

  /**
   * Creates a snapshot of the current orchestrator state for clients
   * Includes orb states, recent captions, autopilot status, and shared screen mode
   */
  private snapshot(): OrchestratorStateSnapshot {
    return {
      orbStates: { ...this.orbStates },
      captions: [...this.captions].slice(0, CAPTION_SNAPSHOT_LIMIT),
      autopilot: this.autopilot,
      sharedScreen: this.sharedScreen,
    };
  }

  async shutdown(): Promise<void> {
    console.info("[orchestrator] shutting down...");

    for (const [sessionId, _] of this.activeSessions) {
      await this.cleanupSession(sessionId);
    }

    console.info("[orchestrator] shutdown complete");
  }

  /**
   * Applies gain to an audio buffer by scaling the amplitude of 16-bit PCM samples.
   * Used for ducking (reducing agent volume when human speaks).
   *
   * @param buffer - Raw audio buffer containing 16-bit little-endian PCM samples
   * @param gain - Gain multiplier (e.g., 0.25 for -12dB reduction)
   * @returns New buffer with gain applied, clamped to valid 16-bit range
   */
  private applyGain(buffer: Buffer, gain: number): Buffer {
    const scaled = Buffer.allocUnsafe(buffer.length);

    // Process audio in 16-bit chunks (2 bytes per sample)
    for (let i = 0; i < buffer.length; i += 2) {
      // Handle odd-length buffers gracefully
      if (i + 1 >= buffer.length) {
        scaled[i] = buffer[i];
        continue;
      }

      // Read 16-bit sample, apply gain, and clamp to valid range
      const sample = buffer.readInt16LE(i);
      let value = Math.round(sample * gain);
      value = Math.max(-32768, Math.min(32767, value));
      scaled.writeInt16LE(value, i);
    }

    return scaled;
  }
}

/**
 * Context for a single WebSocket session, tracking all session-specific state
 */
interface SessionContext {
  /** Unique session identifier (socket.id) */
  sessionId: string;
  /** WebSocket connection to the client */
  socket: Socket<ClientToServerEvents, ServerToClientEvents>;
  /** Event logger for this session */
  eventLogger: EventLogger;
  /** Audio/caption recorder for this session */
  recorder: RecorderService;
  /** Loaded episode briefing (if provided) */
  briefing?: ParsedBriefing;
  /** Whether audio recording is active */
  isRecording: boolean;
  /** Whether any participant is speaking */
  isSpeaking: boolean;
  /** Voice Activity Detector for human speech */
  vad: VadDetector;
  /** Command router for parsing user commands */
  commandRouter: CommandRouter;
  /** TTS adapters for each agent */
  ttsAdapters: Partial<Record<AgentSpeaker, TtsAdapter>>;
  /** Set of agents currently playing audio */
  activeAgentSpeakers: Set<AgentSpeaker>;
  /** Whether audio ducking is currently active */
  duckingActive: boolean;
  /** Whether human is currently speaking (VAD) */
  humanSpeaking: boolean;
  /** Last parsed command from human */
  lastCommand?: CommandRouteResult;
  /** Saved orb states before barge-in (for restoration) */
  orbRestore?: Partial<Record<AgentSpeaker, OrbState>>;
  /** Agents targeted by the most recent command */
  pendingTargets?: Set<AgentSpeaker>;
}
