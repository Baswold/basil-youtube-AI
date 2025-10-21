# TODO List

## Immediate (MVP Scaffold)
- [x] Initialize monorepo structure (frontend, backend, shared) with tooling config.
- [x] Scaffold Next.js 14 frontend: Tailwind setup, ElevenLabs orb component import stub, shared screen layout, placeholder controls.
- [x] Scaffold Node.js backend service: Express server, Socket.io gateway, orchestrator skeleton, mock adapters for STT/TTS/LLM.
- [x] Define shared TypeScript types for WebSocket events and conversation metadata.
- [x] Wire basic frontend ↔ backend WebSocket handshake with mocked orb state/caption events.
- [x] Add pnpm workspace configuration and package scripts for dev/start.

## Near Term (Phase 1 Spec Completion) ✅
- [x] Implement Silero VAD worker integration (stub with mock until model wiring).
- [x] Add STT adapter wrappers (AssemblyAI, Google, faster-whisper local) with env-driven selection.
  - [x] Create adapter interface for STT services
  - [x] Implement AssemblyAI realtime STT adapter
  - [x] Implement Google Cloud STT adapter
  - [x] Implement local faster-whisper adapter
  - [x] Add environment variable configuration for adapter selection
- [x] Implement TTS adapter wrappers (Google Neural2, Piper) with streaming mock.
  - [x] Create adapter interface for TTS services
  - [x] Implement Google Cloud TTS Neural2 adapter
  - [x] Implement local Piper TTS adapter
  - [x] Add streaming capabilities to TTS adapters
- [x] Build Claude Haiku 4.5 adapter and guest OpenAI-compatible adapter interfaces.
  - [x] Implement Anthropic Messages API client for Claude Haiku 4.5
  - [x] Create OpenAI-compatible adapter interface for guest LLMs
  - [x] Add support for Groq, Together.ai, and local llama.cpp as guest LLMs
- [x] Create recorder service writing isolated `.webm` and `.vtt` files per speaker.
  - [x] Implement audio bus manager for three isolated busses
  - [x] Add WebM (Opus 48 kHz) recording functionality
  - [x] Generate VTT caption files from STT output
- [x] Implement basic briefing loader and injection into LLM prompts.
- [x] Provide docker-compose file for local multi-service run (optional - not required!).

## Backend Production Hardening ✅
- [x] Production orchestrator with session management
- [x] Environment-driven configuration system with validation
- [x] Comprehensive error handling (process-level, adapter-level, session-level)
- [x] Graceful shutdown with 30-second timeout
- [x] Health check and ready endpoints
- [x] Event logger service (JSONL format)
- [x] Recorder service (audio + captions + metadata)
- [x] Briefing loader service
- [x] WebSocket lifecycle management
- [x] TypeScript project references for monorepo
- [x] Production documentation (BACKEND_GUIDE.md)
- [x] Production checklist
- [x] Comprehensive .env.example
- [x] Backend-specific .gitignore

## UI/UX Polish (Phase 1.5)
- [x] Professional broadcast-quality interface with glassmorphism
- [x] Animated ElevenLabs orbs with state-based visual feedback
- [x] Live caption display with smooth transitions and speaker color coding
- [x] Connection indicators with pulsing status dots
- [x] Enhanced autopilot toggle with gradient effects
- [x] Toggleable control panel with system status
- [x] Custom animations (fade-in, slide-up, scale, pulse)
- [x] Background particle effects and ambient glow
- [x] Custom scrollbar and selection styling
- [x] Comprehensive UI documentation (UI_GUIDE.md)

## Testing Phase ✅
- [x] Set up Vitest testing infrastructure
- [x] Write EventLogger service tests (12 tests)
- [x] Write Recorder service tests (13 tests)
- [x] Write BriefingLoader service tests (14 tests)
- [x] Write Configuration validation tests (11 tests)
- [x] Write Mock Adapter tests (10 tests)
- [x] Write Orchestrator integration tests (8 tests)
- [x] Create comprehensive testing documentation
- [x] Add test scripts to package.json
- [x] Set up coverage reporting

## Mid Term (Phase 2 Enhancements)
- [ ] Flesh out barge-in logic with command routing and ducking control.
  - [ ] Implement VAD-based interruption detection
  - [ ] Add ducking functionality (reduce agent volume by 12 dB when human speaks)
  - [ ] Create command routing system for addressing specific agents
- [ ] Build thinking mode trigger handling and shared screen visual transitions.
  - [ ] Implement thinking mode detection and trigger interception
  - [ ] Add visual transition handling for shared screen states
  - [ ] Create countdown timer for thinking mode
- [x] Generate JSONL event logger and session metadata files.
  - [x] Implement comprehensive event logging
  - [x] Create session.yml metadata file generation
- [x] Integrate UI captions with smooth transitions and speaker color coding.
- [x] Add Autopilot toggle and Showrunner stub state machine.

## Longer Term (Phase 3+)
- [ ] Implement full Autopilot run-of-show with prompts and timing automation.
  - [ ] Create Showrunner state machine with segment order logic
  - [ ] Implement cold open, guest stance, cross-exam, steelman swap, verdict, and outro segments
  - [ ] Add prompt management for each segment type
- [ ] Add health checks, circuit breakers, and provider failover.
  - [ ] Implement service health monitoring
  - [ ] Add circuit breaker pattern for external API calls
  - [ ] Create failover mechanisms between STT/TTS/LLM providers
- [ ] Create episode dashboard listing recordings, captions, and logs.
  - [ ] Build web interface for browsing episode artifacts
  - [ ] Add search and filtering capabilities
  - [ ] Implement playback controls for reviewing episodes
- [ ] Integrate S3-compatible storage for artifacts.
  - [ ] Add S3 storage adapter
  - [ ] Implement artifact upload functionality
  - [ ] Create download links for episode files
- [ ] Build latency/performance monitoring instrumentation.
  - [ ] Add timing metrics for STT, LLM, and TTS services
  - [ ] Implement dashboard for monitoring performance
  - [ ] Add alerting for performance degradation

## Future Ideas
- [ ] Generative thinking-mode visuals (shader or particle system).
- [ ] On-screen citation cards sourced from fact-check service.
- [ ] Viewer suggestion ingestion pipeline for topics/briefings.
- [ ] Automated Premiere project template export.

## Agent Execution Plans
Link to plans under `docs/plans/`. Each agent has a distinct, non-overlapping scope.

- AGENT-1: Developer Experience and Standards
  - docs/plans/AGENT-1-dx-and-standards.md
- AGENT-2: Shared Package Build & Type-Safe Consumption
  - docs/plans/AGENT-2-shared-package-build.md
- AGENT-3: Backend Security & Structured Logging
  - docs/plans/AGENT-3-backend-security-logging.md
- AGENT-4: Orchestrator Realtime STT/TTS + Frontend Tests + CI
  - docs/plans/AGENT-4-orchestrator-stt-tts-and-frontend-tests.md
