# Backend Production Guide

## 🎯 Overview

Production-ready backend for the Three-Way Voice Studio with:
- ✅ **Robust error handling** at every level
- ✅ **Graceful shutdown** with cleanup
- ✅ **Environment-driven configuration**
- ✅ **Real adapter integration** (STT/TTS/LLM)
- ✅ **Recording & logging** services
- ✅ **Health checks** and monitoring
- ✅ **TypeScript type safety** throughout

---

## 🏗️ Architecture

### Core Components

1. **Server** (`src/index.ts`)
   - Express HTTP server
   - Socket.IO WebSocket gateway
   - Health check endpoints
   - Graceful shutdown handling
   - Error recovery

2. **Orchestrator** (`src/orchestrator-v2.ts`)
   - Session management
   - Adapter coordination
   - State synchronization
   - Event routing
   - Cleanup lifecycle

3. **Configuration** (`src/config.ts`)
   - Environment validation
   - Provider selection
   - API key management
   - Default values

4. **Adapters** (`src/adapters/`)
   - STT: AssemblyAI, Google Cloud, Whisper
   - TTS: Google Neural2, Piper
   - LLM: Claude Haiku 4.5, Groq, Together.ai, OpenAI
   - Factory pattern with env-driven selection

5. **Services** (`src/services/`)
   - **Recorder**: Isolated audio tracks + VTT captions
   - **Event Logger**: JSONL event stream
   - **Briefing Loader**: Episode briefings

---

## ⚙️ Configuration

### Environment Variables

Create `.env` file in `apps/backend/`:

```bash
# ============================================
# Server Configuration
# ============================================
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# ============================================
# Feature Flags
# ============================================
USE_REAL_ADAPTERS=false  # Set to 'true' for production

# ============================================
# Provider Selection
# ============================================
STT_PROVIDER=assemblyai  # Options: assemblyai, google, whisper
TTS_PROVIDER=google      # Options: google, piper
GUEST_PROVIDER=groq      # Options: groq, together, local, openai

# ============================================
# API Keys (Required when USE_REAL_ADAPTERS=true)
# ============================================
ANTHROPIC_API_KEY=sk-ant-xxxxx
ASSEMBLYAI_API_KEY=xxxxx
GROQ_API_KEY=gsk_xxxxx

# Optional API Keys
TOGETHER_API_KEY=xxxxx
OPENAI_API_KEY=sk-xxxxx

# Google Cloud (set path to credentials JSON)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-credentials.json

# ============================================
# Service Endpoints (for local services)
# ============================================
WHISPER_ENDPOINT=http://localhost:8001/transcribe
LOCAL_LLAMA_ENDPOINT=http://localhost:8080/v1

# ============================================
# Piper Configuration
# ============================================
PIPER_PATH=piper
PIPER_MODEL_PATH=./models/en_US-lessac-medium.onnx

# ============================================
# Model Selection
# ============================================
GUEST_MODEL=llama-3.3-70b-versatile  # Model for guest LLM

# ============================================
# Storage
# ============================================
RECORDING_DIR=./recordings
BRIEFINGS_DIR=./briefings
```

### Configuration Validation

The server **validates all configuration** on startup:
- Checks required API keys based on selected providers
- Validates environment values
- Exits with clear error messages if invalid

---

## 🚀 Running the Backend

### Development Mode (Mock Adapters)

```bash
# From repo root
pnpm install
pnpm dev:backend

# Or from backend directory
cd apps/backend
pnpm dev
```

This runs with `USE_REAL_ADAPTERS=false` (default) using mock adapters.

### Production Mode (Real Adapters)

1. **Set up environment**:
```bash
cp .env.example .env
# Edit .env with your API keys
```

2. **Enable real adapters**:
```bash
echo "USE_REAL_ADAPTERS=true" >> .env
```

3. **Run the server**:
```bash
pnpm dev:backend
```

### Build for Production

```bash
pnpm build
pnpm start
```

---

## 🏥 Health Checks

### Health Endpoint

```bash
curl http://localhost:4000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "version": "1.0.0",
  "adapters": {
    "enabled": true,
    "stt": "assemblyai",
    "tts": "google",
    "guest": "groq"
  }
}
```

### Ready Endpoint

```bash
curl http://localhost:4000/ready
```

Response:
```json
{
  "status": "ready"
}
```

---

## 🔌 WebSocket Events

### Client → Server

```typescript
// Initial handshake
socket.emit("hello", {
  participantName: "frontend",
  episodeId: "episode-123"
});

// Send audio chunk
socket.emit("audio.chunk", audioBuffer);

// Toggle autopilot
socket.emit("client.toggle-autopilot", true);

// Request current state
socket.emit("client.request-state");
```

### Server → Client

```typescript
// Acknowledgment
socket.on("server.ack", (message: string) => {
  console.log("Server:", message);
});

// State snapshot
socket.on("state.snapshot", (snapshot: OrchestratorStateSnapshot) => {
  // Update UI with orbStates, captions, autopilot
});

// Orb state change
socket.on("orb.state", (speaker: SpeakerId, state: OrbState) => {
  // Update specific orb
});

// New caption
socket.on("caption", (caption: CaptionPayload) => {
  // Display caption
});

// Recording ready
socket.on("recording.ready", (payload: RecordingReadyPayload) => {
  // Download files: payload.files
});
```

---

## 📁 Recording Output

Each episode creates a directory: `./recordings/<episode-id>/`

### Files Generated

```
recordings/episode-1234567890/
├── you.webm           # Your audio track (Opus 48kHz)
├── claude.webm        # Claude's audio track
├── guest.webm         # Guest AI's audio track
├── you.vtt            # Your captions
├── claude.vtt         # Claude's captions
├── guest.vtt          # Guest's captions
├── events.jsonl       # Complete event log
└── session.yml        # Session metadata
```

### Event Log Format

Each line in `events.jsonl` is a JSON event:

```json
{"type":"session.start","timestamp":1234567890,"sessionId":"abc123","episodeId":"episode-1","config":{}}
{"type":"stt.final","timestamp":1234567891,"sessionId":"abc123","speaker":"you","text":"Hello"}
{"type":"llm.start","timestamp":1234567892","sessionId":"abc123","speaker":"claude","model":"claude-3-5-haiku"}
{"type":"llm.complete","timestamp":1234567893","sessionId":"abc123","speaker":"claude","latency":150}
```

---

## 🛡️ Error Handling

### Levels of Protection

1. **Configuration Validation** - Fails fast on startup if config is invalid
2. **Try-Catch Blocks** - Around all async operations
3. **Adapter Error Callbacks** - Logged and reported to client
4. **Socket Error Handlers** - Graceful disconnect on errors
5. **Process Error Handlers** - Uncaught exceptions trigger graceful shutdown
6. **Graceful Shutdown** - 30-second timeout for cleanup

### Error Logging

All errors are logged with context:
```typescript
[orchestrator] STT error for session-123: Connection timeout
[server] Socket.IO error: Authentication failed
```

### Event Logger Errors

Errors are logged to `events.jsonl`:
```json
{"type":"error","timestamp":1234567890,"sessionId":"abc123","error":"Connection timeout","stack":"...","context":{"service":"stt"}}
```

---

## 🧪 Testing

### Manual Testing

1. **Start backend**:
```bash
pnpm dev:backend
```

2. **Check health**:
```bash
curl http://localhost:4000/health
```

3. **Connect with frontend**:
```bash
# In separate terminal
pnpm dev:frontend
```

4. **Test WebSocket**:
- Open frontend at http://localhost:3000
- Check connection indicator turns green
- Toggle autopilot and observe state changes

### Automated Testing (Future)

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

---

## 🚨 Troubleshooting

### Server Won't Start

**Problem**: `Configuration validation failed`

**Solution**: Check `.env` file has all required API keys for selected providers.

---

**Problem**: `Port 4000 already in use`

**Solution**: 
```bash
# Find and kill process
lsof -ti:4000 | xargs kill -9

# Or change port
PORT=4001 pnpm dev:backend
```

---

### WebSocket Connection Fails

**Problem**: Frontend can't connect to backend

**Solution**:
1. Check backend is running: `curl http://localhost:4000/health`
2. Check CORS settings in `.env`
3. Verify `NEXT_PUBLIC_BACKEND_URL` in frontend `.env`

---

### STT/TTS Not Working

**Problem**: No transcripts or audio output

**Solution**:
1. Check `USE_REAL_ADAPTERS=true` in `.env`
2. Verify API keys are correct
3. Check adapter selection matches your API keys
4. Review logs for specific error messages

---

### Recording Files Not Created

**Problem**: No files in `./recordings/`

**Solution**:
1. Ensure `RECORDING_DIR` is writable
2. Check session completed successfully (no crashes)
3. Look for errors in event logger

---

## 📊 Monitoring

### Console Output

On startup, you'll see:
```
============================================================
Backend Configuration
============================================================
Environment:       development
Port:              4000
CORS Origins:      http://localhost:3000
Use Real Adapters: false
STT Provider:      assemblyai
TTS Provider:      google
Guest Provider:    groq
Recording Dir:     ./recordings
Briefings Dir:     ./briefings
============================================================
✅ Backend listening on http://localhost:4000
   WebSocket ready for connections
   Health check: http://localhost:4000/health
```

### Session Logs

During operation:
```
[server] new connection: abc123
[orchestrator] registering session abc123
[orchestrator] session abc123 registered successfully
[orchestrator] hello from frontend
[orchestrator] autopilot enabled
[orchestrator] STT (final): Hello, how are you?
[orchestrator] recording stopped, files: you.webm, claude.webm, guest.webm, ...
[orchestrator] session abc123 cleaned up
```

---

## 🔐 Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` template
2. **Rotate API keys regularly**
3. **Use environment-specific configs** for dev/staging/prod
4. **Limit CORS origins** to trusted domains
5. **Enable HTTPS** in production
6. **Monitor API usage** to detect anomalies

---

## 🚀 Deployment

### Docker

```bash
# Build image
docker build -t voice-studio-backend .

# Run container
docker run -p 4000:4000 \
  -e USE_REAL_ADAPTERS=true \
  -e ANTHROPIC_API_KEY=xxx \
  voice-studio-backend
```

### Docker Compose

```bash
docker-compose up backend
```

### Environment-Specific Configs

```bash
# Development
NODE_ENV=development pnpm dev

# Staging
NODE_ENV=staging pnpm start

# Production
NODE_ENV=production pnpm start
```

---

## 📈 Performance Tips

1. **Use AssemblyAI for STT** - Fastest real-time transcription
2. **Use Groq for guest LLM** - Extremely fast inference
3. **Enable compression** for WebSocket messages
4. **Monitor memory usage** - Restart if it grows unbounded
5. **Use connection pooling** for database connections (future)

---

## 🎯 Next Steps

- [ ] Add authentication/authorization
- [ ] Implement rate limiting
- [ ] Add metrics collection (Prometheus)
- [ ] Set up structured logging (Winston/Pino)
- [ ] Add API documentation (Swagger)
- [ ] Implement automated tests
- [ ] Add database for session persistence
- [ ] Create admin dashboard

---

**Built with Production in Mind** 🏗️

Every component is designed for reliability, observability, and maintainability.
