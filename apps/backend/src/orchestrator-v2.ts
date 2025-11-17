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
import { EnhancedVadDetector } from "./services/vad-detector-enhanced.js";
import { EnhancedCommandRouter } from "./services/command-router-enhanced.js";
import { MultiChannelAudioProcessor } from "./services/audio-processor.js";
import { BargeInManager, type BargeInMode } from "./services/barge-in-manager.js";

interface OrchestratorConfig {
  useRealAdapters?: boolean;
  episodeId?: string;
  briefingPath?: string;
  recordingDir?: string;
  useEnhancedFeatures?: boolean; // Enable enhanced VAD, command routing, and barge-in
  bargeInMode?: BargeInMode;
  duckingProfile?: "soft" | "medium" | "hard";
}

type AgentSpeaker = Extract<SpeakerId, "claude" | "guest">;

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
  private duckingGain = Math.pow(10, -12 / 20);

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      useRealAdapters: process.env.USE_REAL_ADAPTERS === "true",
      episodeId: config.episodeId || `episode-${Date.now()}`,
      briefingPath: config.briefingPath,
      recordingDir: config.recordingDir || "./recordings",
      useEnhancedFeatures: process.env.USE_ENHANCED_FEATURES === "true" || config.useEnhancedFeatures || false,
      bargeInMode: (config.bargeInMode as BargeInMode) || "graceful",
      duckingProfile: config.duckingProfile || "medium",
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

    const vad = new VadDetector({
      onSpeechStart: () => this.handleHumanSpeechStart(sessionId),
      onSpeechEnd: () => this.handleHumanSpeechEnd(sessionId),
    });

    const commandRouter = new CommandRouter();

    // Initialize enhanced features if enabled
    const useEnhancedFeatures = this.config.useEnhancedFeatures || false;
    let enhancedVad: EnhancedVadDetector | undefined;
    let enhancedCommandRouter: EnhancedCommandRouter | undefined;
    let audioProcessor: MultiChannelAudioProcessor | undefined;
    let bargeInManager: BargeInManager | undefined;

    if (useEnhancedFeatures) {
      console.info(`[orchestrator] initializing enhanced features for session ${sessionId}`);

      // Enhanced VAD with confidence scoring and adaptive thresholds
      enhancedVad = new EnhancedVadDetector({
        sampleRate: 48_000,
        adaptiveThreshold: true,
        confidenceEnabled: true,
        spectralAnalysis: true,
        onSpeechStart: (confidence) => this.handleEnhancedHumanSpeechStart(sessionId, confidence),
        onSpeechEnd: (confidence) => this.handleEnhancedHumanSpeechEnd(sessionId, confidence),
      });

      // Enhanced command router with fuzzy matching
      enhancedCommandRouter = new EnhancedCommandRouter();

      // Multi-channel audio processor with smooth ducking
      audioProcessor = new MultiChannelAudioProcessor({
        sampleRate: 48_000,
        ducking: {
          profile: this.config.duckingProfile,
          rampUpMs: 50,
          rampDownMs: 150,
          curve: "exponential",
        },
      });

      // Barge-in manager for coordinated interruption handling
      bargeInManager = new BargeInManager(
        {
          mode: this.config.bargeInMode,
          gracePeriodMs: 300,
          duckingEnabled: true,
          duckingLeadTimeMs: 150,
        },
        eventLogger
      );

      // Set up barge-in callbacks
      bargeInManager.setCallbacks({
        onBargeInStart: (interrupter, interrupted) => {
          this.handleBargeInStart(sessionId, interrupter, interrupted);
        },
        onBargeInComplete: (interrupter, interrupted) => {
          this.handleBargeInComplete(sessionId, interrupter, interrupted);
        },
        onDuckingRequest: (speakers, enable) => {
          this.handleDuckingRequest(sessionId, speakers as AgentSpeaker[], enable);
        },
      });

      console.info(`[orchestrator] enhanced features initialized for session ${sessionId}`);
    }

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
      useEnhancedFeatures,
      enhancedVad,
      enhancedCommandRouter,
      audioProcessor,
      bargeInManager,
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

    // Use enhanced VAD if enabled, otherwise fall back to standard VAD
    if (context.useEnhancedFeatures && context.enhancedVad) {
      context.enhancedVad.processAudio(buffer);
    } else {
      context.vad.processAudio(buffer);
    }

    // Send to STT if available
    // For now, this is a placeholder - will be wired when STT is fully integrated

    // Record audio (for "you" speaker)
    await context.recorder.writeAudioChunk("you", buffer);
  }

  private handleHumanSpeechStart(sessionId: string): void {
    const context = this.activeSessions.get(sessionId);
    if (!context || context.humanSpeaking) return;

    context.humanSpeaking = true;
    context.duckingActive = true;
    context.eventLogger.logVadSpeechStart(sessionId, "you");

    const interrupted = Array.from(context.activeAgentSpeakers);
    if (interrupted.length > 0) {
      context.eventLogger.logBargeIn(sessionId, "you", interrupted);
      for (const speaker of interrupted) {
        void this.stopAgentPlayback(context, speaker);
      }
      context.activeAgentSpeakers.clear();
    }

    context.orbRestore = {
      claude: this.orbStates.claude,
      guest: this.orbStates.guest,
    };

    this.updateOrbState("you", "speaking", context);
    for (const agent of ["claude", "guest"] as AgentSpeaker[]) {
      this.updateOrbState(agent, "muted", context);
    }
  }

  private handleHumanSpeechEnd(sessionId: string): void {
    const context = this.activeSessions.get(sessionId);
    if (!context || !context.humanSpeaking) return;

    context.humanSpeaking = false;
    context.duckingActive = false;
    context.eventLogger.logVadSpeechEnd(sessionId, "you");

    this.updateOrbState("you", "listening", context);

    const restore = context.orbRestore;
    if (restore) {
      for (const agent of ["claude", "guest"] as AgentSpeaker[]) {
        const previous = restore[agent];
        this.updateOrbState(agent, previous ?? "listening", context);
      }
      context.orbRestore = undefined;
    } else {
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

  // Enhanced feature handlers

  private handleEnhancedHumanSpeechStart(sessionId: string, confidence: number): void {
    const context = this.activeSessions.get(sessionId);
    if (!context || !context.useEnhancedFeatures) return;

    console.info(`[orchestrator-enhanced] human speech start (confidence: ${confidence.toFixed(2)})`);

    // Delegate to barge-in manager for coordinated handling
    context.bargeInManager?.onSpeechStart("you", confidence);

    // Also trigger standard handler for compatibility
    this.handleHumanSpeechStart(sessionId);
  }

  private handleEnhancedHumanSpeechEnd(sessionId: string, confidence: number): void {
    const context = this.activeSessions.get(sessionId);
    if (!context || !context.useEnhancedFeatures) return;

    console.info(`[orchestrator-enhanced] human speech end (confidence: ${confidence.toFixed(2)})`);

    // Delegate to barge-in manager
    context.bargeInManager?.onSpeechEnd("you", confidence);

    // Also trigger standard handler for compatibility
    this.handleHumanSpeechEnd(sessionId);
  }

  private handleBargeInStart(
    sessionId: string,
    interrupter: SpeakerId,
    interrupted: SpeakerId[]
  ): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    console.info(`[orchestrator-enhanced] barge-in start: ${interrupter} interrupting ${interrupted.join(", ")}`);

    // Stop interrupted speakers
    for (const speaker of interrupted) {
      if (speaker !== "you") {
        void this.stopAgentPlayback(context, speaker as AgentSpeaker);
      }
    }

    // Update orb states
    this.updateOrbState(interrupter, "speaking", context);
  }

  private handleBargeInComplete(
    sessionId: string,
    interrupter: SpeakerId,
    interrupted: SpeakerId[]
  ): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    console.info(`[orchestrator-enhanced] barge-in complete: ${interrupter} interrupted ${interrupted.join(", ")}`);

    // Log completion event
    context.eventLogger.logBargeIn(sessionId, interrupter, interrupted);
  }

  private handleDuckingRequest(
    sessionId: string,
    speakers: AgentSpeaker[],
    enable: boolean
  ): void {
    const context = this.activeSessions.get(sessionId);
    if (!context || !context.audioProcessor) return;

    console.info(`[orchestrator-enhanced] ducking ${enable ? "enabled" : "disabled"} for ${speakers.join(", ")}`);

    if (enable) {
      context.audioProcessor.startDucking(speakers);
      context.duckingActive = true;
    } else {
      context.audioProcessor.stopDucking(speakers);
      context.duckingActive = false;
    }
  }

  private enterThinkingMode(context: SessionContext, command: CommandRouteResult): void {
    const speaker = (command.targets[0] as AgentSpeaker) || "claude";
    const durationMs = command.durationMs ?? 30_000;
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

      // Use enhanced command router if enabled, otherwise fall back to standard router
      let command;
      if (context.useEnhancedFeatures && context.enhancedCommandRouter) {
        command = context.enhancedCommandRouter.route(text, context.enhancedCommandRouter.getContext());
        if (command && command.fuzzyMatched) {
          console.info(`[orchestrator-enhanced] fuzzy match: "${text}" -> "${command.matchedKeywords?.join(", ")}"`);
        }
      } else {
        command = context.commandRouter.route(text);
      }

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

    // Use enhanced audio processor if enabled, otherwise fall back to simple gain
    let processedChunk: Buffer;
    if (context.useEnhancedFeatures && context.audioProcessor) {
      // Enhanced processor handles smooth ducking with ramps
      processedChunk = context.audioProcessor.processAudio(speaker, audioChunk);
    } else {
      // Fallback to simple gain-based ducking
      processedChunk = context.duckingActive ? this.applyGain(audioChunk, this.duckingGain) : audioChunk;
    }

    context.recorder.writeAudioChunk(speaker, processedChunk);

    if (!context.activeAgentSpeakers.has(speaker)) {
      context.activeAgentSpeakers.add(speaker);
      context.eventLogger.logTtsStart(sessionId, speaker, context.lastCommand?.remainder ?? "");
      this.updateOrbState(speaker, "speaking", context);

      // Notify barge-in manager that agent started speaking
      if (context.useEnhancedFeatures && context.bargeInManager) {
        context.bargeInManager.onSpeechStart(speaker, 0.9);
      }
    }

    context.eventLogger.logTtsChunk(sessionId, speaker, processedChunk.length);
  }

  private handleTtsComplete(sessionId: string, speaker: AgentSpeaker): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    console.info(`[orchestrator] TTS complete for ${sessionId} (${speaker})`);
    context.eventLogger.logTtsComplete(sessionId, speaker);
    context.activeAgentSpeakers.delete(speaker);

    // Notify barge-in manager that agent stopped speaking
    if (context.useEnhancedFeatures && context.bargeInManager) {
      context.bargeInManager.onSpeechEnd(speaker, 0.9);
    }

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

  private addCaption(caption: CaptionPayload): void {
    this.captions = [caption, ...this.captions].slice(0, 20);
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

  private snapshot(): OrchestratorStateSnapshot {
    return {
      orbStates: { ...this.orbStates },
      captions: [...this.captions].slice(0, 6),
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
}

  private applyGain(buffer: Buffer, gain: number): Buffer {
    const scaled = Buffer.allocUnsafe(buffer.length);

    for (let i = 0; i < buffer.length; i += 2) {
      if (i + 1 >= buffer.length) {
        scaled[i] = buffer[i];
        continue;
      }

      const sample = buffer.readInt16LE(i);
      let value = Math.round(sample * gain);
      value = Math.max(-32768, Math.min(32767, value));
      scaled.writeInt16LE(value, i);
    }

    return scaled;
  }

interface SessionContext {
  sessionId: string;
  socket: Socket<ClientToServerEvents, ServerToClientEvents>;
  eventLogger: EventLogger;
  recorder: RecorderService;
  briefing?: any;
  isRecording: boolean;
  isSpeaking: boolean;
  vad: VadDetector;
  commandRouter: CommandRouter;
  ttsAdapters: Partial<Record<AgentSpeaker, TtsAdapter>>;
  activeAgentSpeakers: Set<AgentSpeaker>;
  duckingActive: boolean;
  humanSpeaking: boolean;
  lastCommand?: CommandRouteResult;
  orbRestore?: Partial<Record<AgentSpeaker, OrbState>>;
  pendingTargets?: Set<AgentSpeaker>;
  // Enhanced features
  enhancedVad?: EnhancedVadDetector;
  enhancedCommandRouter?: EnhancedCommandRouter;
  audioProcessor?: MultiChannelAudioProcessor;
  bargeInManager?: BargeInManager;
  useEnhancedFeatures: boolean;
}
