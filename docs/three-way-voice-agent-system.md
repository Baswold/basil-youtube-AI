# Three-Way Voice Agent System — Technical Spec

## System Overview

Hands-free, real-time conversation studio featuring three participants: you (Basil), Claude Haiku 4.5 as the permanent co-host, and a rotating guest AI (Grok, Groq, etc.). All speech is captured on isolated tracks, interruptions are allowed, and the UI uses animated orbs positioned above a shared screen for captions, briefings, or thinking visuals.

- True free-flow banter (no scripted turns)
- Claude and Guest listen continuously and can interrupt
- Thinking mode pauses the conversation with hypnotic visuals
- Autopilot lets Claude host solo with a guest AI

---

## UI / Frontend Architecture

### Layout

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│      ◯         ◯ ★         ◯                        │
│    YOU      CLAUDE      GUEST                       │
│   (webcam)   (orb)      (orb)                       │
│      ╱         │          ╲                         │
│   ┌───────────────────────────────────────────┐    │
│   │                                           │    │
│   │     SHARED SCREEN / PAPER                 │    │
│   │                                           │    │
│   │   • Captions during conversation          │    │
│   │   • Thinking visuals during pauses        │    │
│   │   • Briefing/topic at start               │    │
│   │                                           │    │
│   └───────────────────────────────────────────┘    │
│                                                     │
│   Floating controls: Record, Mute, Autopilot         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Design Notes

- **Circles:** 200–240 px diameter, overlapping top edge of shared screen.
  - You: live webcam feed with cyan/green glow (`#10b981`).
  - Claude: ElevenLabs orb with blue glow (`#3b82f6`).
  - Guest: ElevenLabs orb with orange glow (`#f59e0b`).
- **Background:** Dark navy (`#0a0e27`).
- **Text:** Light gray (`#d1d5db`) with minimal bright white accents.
- **Controls:** Floating icon buttons (⏺, 🎤, 🤖) in bottom-right corner.

### Shared Screen States

| Mode | Visuals | Behavior |
| --- | --- | --- |
| Conversation | Live captions, speaker name in bold, smooth fade transitions. | Orbs animate with audio. |
| Thinking | Hypnotic visuals (particles, fractals, waveform, spinner) + countdown timer. | Thinking orb intensifies, others dim and mute. |
| Pre-show | Topic briefing, must-cover points, tone guidance. | Injected into LLM system prompts. |

---

## Backend Architecture

All services run together (e.g., Docker Compose) and communicate via a single WebSocket gateway.

| Service | Responsibilities |
| --- | --- |
| Orchestrator | Conversation state, turn-taking, addressing tags, barge-in, thinking mode, event emission. |
| STT Adapter | AssemblyAI realtime (recommended), Google Cloud STT, or local faster-whisper. |
| LLM Adapters | Claude Haiku 4.5 (Anthropic Messages API) and pluggable OpenAI-compatible guest. |
| TTS Adapter | Google Cloud TTS Neural2 (recommended), Azure Neural TTS, or local Piper. |
| Audio Bus Manager | Three isolated busses (`bus_you`, `bus_claude`, `bus_guest`), ducking, monitor mix, .webm recording. |
| VAD Worker | Silero VAD (Node WASM) to trigger STT, barge-in, and agent completion. |
| Recorder | Continuous per-speaker `.webm` (Opus 48 kHz) plus `.vtt` captions. |
| JSONL Logger | Every event (VAD, STT, LLM, TTS, orb state) for replay/debug. |
| Briefing Loader | Injects Markdown briefings into LLM system prompts. |
| WebSocket Gateway | Typed, timestamped messages between browser and backend. |

### WebSocket Events

**Browser → Backend**
```json
{ "t": "audio.chunk", "data": "base64", "ts": 123.45 }
{ "t": "client.toggle-autopilot", "on": true }
{ "t": "client.briefing", "url": "/briefings/episode-1.md" }
```

**Backend → Browser**
```json
{ "t": "orb.state", "who": "claude", "state": "thinking" }
{ "t": "caption", "who": "guest", "text": "Actually...", "ts": 124.51 }
{ "t": "mode.thinking", "who": "claude", "duration": 30000 }
{ "t": "recording.ready", "files": ["you.webm", "claude.webm", "guest.webm"] }
```

---

## Audio & Conversation Flow

### Main Pipeline

```
Mic → VAD → STT → Orchestrator → LLMs (parallel) → Clause buffering → TTS → Isolated bus → Recorder + Monitor → UI events
```

Key details:
- VAD gates STT to reduce cost and triggers ducking/barge-in.
- Both LLMs stream simultaneously; orchestrator chooses speaker by addressing or first-complete.
- TTS uses clause buffering (punctuation or ~600 ms) before playback.
- Ducking reduces agent volume by 12 dB while you speak.
- All tracks record continuously to avoid missing audio.

### Barge-in Flow

1. Claude or Guest is speaking via TTS.
2. VAD detects your voice.
3. Orchestrator stops both TTS streams and cancels in-flight generations.
4. UI orbs switch to muted state.
5. You speak; once finished, orchestrator resumes queued responses.

### Thinking Mode Flow

1. Claude says "Can I think for a minute?" (spoken via TTS).
2. Orchestrator intercepts trigger, pauses playback, enters thinking mode for 30 s.
3. UI switches to visuals and timer; non-thinking orbs dim/mute.
4. Claude continues generating silently in background.
5. After timer ends, cached response plays: "Okay, here's what I was thinking...".

---

## Conversation Metadata

### Speaker Envelope

Wrap each utterance:

```
<speaker name="Basil">
I think Claude should defend the opposite view.
</speaker>
```

### Addressing Tags (Optional)

```
<to name="Claude">
Can you argue that small LLMs are actually better?
</to>
```

Free-flow discussion: both AIs receive the full history and decide when to reply.

---

## Autopilot Mode

- Toggle mutes your mic; Showrunner state machine drives prompts.
- Segment order: cold open (15 s) → guest stance (60 s) → cross-exam (2–4 min) → steelman swap (90 s) → verdict (45 s) → outro (15 s).
- Orchestrator treats Showrunner cues like manual turn assignments.
- All standard recording/caption/orb behaviors remain active.

---

## Tech Stack

| Layer | Preferred Option | Alternatives |
| --- | --- | --- |
| Frontend | Next.js 14, Tailwind, ElevenLabs Orb component, Zustand state | Vite + React |
| Transport | Socket.io (browser ↔ backend) | Native WebSocket |
| Backend Runtime | Node.js 20 + Express/Hono | | 
| STT | AssemblyAI realtime | Google Cloud STT, local faster-whisper |
| TTS | Google Cloud TTS Neural2 | Azure Neural TTS, local Piper |
| LLM | Claude Haiku 4.5 (Anthropic Messages API) | Claude Sonnet 4.5 for complex turns |
| Guest LLM | OpenAI-compatible endpoint (Grok, Groq, Together, local llama.cpp) | |
| Audio | Silero VAD, WebM (Opus 48 kHz) recording | | 
| Storage | Local disk (dev), S3-compatible (prod) | |
| Deployment | Docker Compose (dev/prod) | Kubernetes |

---

## Artifacts Per Episode

```
/recordings/<episode>/
  ├── you.webm
  ├── claude.webm
  ├── guest.webm
  ├── you.vtt
  ├── claude.vtt
  ├── guest.vtt
  ├── events.jsonl
  └── session.yml
```

- `.webm`: isolated audio tracks (Opus 48 kHz).
- `.vtt`: captions from STT (you) and from TTS timings (Claude/Guest).
- `events.jsonl`: replayable event log.
- `session.yml`: models, versions, timestamps, environment metadata.

---

## Cost per 20-minute Episode

| Item | Estimated Cost |
| --- | --- |
| STT (15 min via AssemblyAI) | ~$0.09 |
| TTS (Claude + Guest, ~7k chars) | ~$0.11 |
| Claude Haiku 4.5 tokens | ~$0.08 |
| Guest LLM tokens | ~$0.02–$0.05 |
| **Total** | **~$0.30–$0.35** |

**Local fallback:** faster-whisper + Piper + Claude Haiku ≈ **$0.08**.

---

## Development Roadmap

### Phase 1 – MVP (Weeks 1–2)
- Next.js frontend with orbs + webcam circles.
- Orchestrator skeleton, STT/TTS adapters, Claude + guest connectors.
- WebSocket gateway, Silero VAD, isolated recorders.
- Captions + basic UI state.
- ✅ Goal: record one conversation into three separate `.webm` files.

### Phase 2 – Polish (Weeks 3–4)
- Robust barge-in + ducking, addressing tags.
- Parallel generation logic for free-flow chat.
- Thinking mode visuals + timers.
- Briefing loader, JSONL logging, VTT generation.
- ✅ Goal: produce a full episode ready for editing.

### Phase 3 – Autopilot (Weeks 5–6)
- Showrunner state machine and Claude host prompts.
- Autopilot UI toggle, guest prompts.
- ✅ Goal: Claude + guest record an episode without human input.

### Phase 4 – Production Hardening (Week 7+)
- Error handling, health checks, circuit breakers.
- Session persistence and resumable recordings.
- S3 storage integration, episode dashboard.
- Latency metrics and monitoring.

---

## Launch Workflow

1. Record live trio conversation.
2. Inspect `events.jsonl` for latency or glitch detection.
3. Export isolated `.webm` + `.vtt` files.
4. Edit in Premiere/Resolve (mix tracks, overlay orb screen capture, add titles).
5. Import captions from `.vtt`.
6. Render final video and upload to YouTube.

Outcome: perfectly isolated voices and production-ready assets.

---

## Key Advantages

- ✨ Natural, unscripted three-way banter.
- ✨ Audio isolation for post-production flexibility.
- ✨ Built-in barge-in and thinking pauses for drama.
- ✨ Cost-efficient (no ElevenLabs voice pricing).
- ✨ Autopilot episodes when you need hands-free production.
- ✨ Comprehensive logs and captions for editing and QA.

---

## Immediate Next Steps

1. Scaffold repository with frontend, backend, and docs structure.
2. Implement Claude Haiku 4.5 adapter and guest LLM interface.
3. Integrate AssemblyAI realtime STT (or local faster-whisper for testing).
4. Test end-to-end audio flow and recording.
5. Layer in thinking mode and Autopilot features.

