# Setup Guide

This guide walks you through setting up the Voice Studio. **Docker is NOT required** - the system runs perfectly with just Node.js and pnpm!

## Prerequisites

- Node.js 20+
- pnpm 8+ (install with `npm install -g pnpm`)

**Optional** (only for specific features):
- Docker & Docker Compose - Only needed if you want to run local Whisper or llama.cpp services
- Google Cloud credentials - Only if using Google STT/TTS
- Piper TTS binary - Only if using local Piper TTS

## Quick Start (No Docker!)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run with Mock Adapters (Easiest!)

No configuration needed! Just run:

```bash
pnpm dev
```

This starts both frontend and backend with **mock adapters** - perfect for development and testing the UI.

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:4000

### 3. Configure Real Adapters (Optional)

Copy the example environment file:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Edit `apps/backend/.env` and add your API keys:

```env
# Required for Claude
ANTHROPIC_API_KEY=sk-ant-...

# Choose ONE STT provider
STT_PROVIDER=assemblyai
ASSEMBLYAI_API_KEY=your_key_here

# OR use Google Cloud STT (requires GOOGLE_APPLICATION_CREDENTIALS)
# STT_PROVIDER=google

# OR use local Whisper (requires separate service)
# STT_PROVIDER=whisper

# Choose ONE TTS provider
TTS_PROVIDER=google  # Requires GOOGLE_APPLICATION_CREDENTIALS

# OR use local Piper
# TTS_PROVIDER=piper
# PIPER_PATH=/usr/local/bin/piper
# PIPER_MODEL_PATH=./models/en_US-lessac-medium.onnx

# Choose ONE guest LLM provider
GUEST_PROVIDER=groq
GROQ_API_KEY=your_key_here

# OR use other providers
# GUEST_PROVIDER=together
# TOGETHER_API_KEY=your_key_here
# GUEST_MODEL=meta-llama/Llama-3-70b-chat-hf
```

### 3. Set Up Google Cloud (if using Google STT/TTS)

1. Create a Google Cloud project
2. Enable Cloud Speech-to-Text API and Cloud Text-to-Speech API
3. Create a service account and download credentials JSON
4. Set environment variable:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/credentials.json
```

### 4. Run Development Servers

```bash
# Run both frontend and backend
pnpm dev

# Or run separately
pnpm dev:backend   # http://localhost:4000
pnpm dev:frontend  # http://localhost:3000
```

## Provider Options

### STT (Speech-to-Text)

#### AssemblyAI (Recommended)
- **Pros:** Best accuracy, real-time streaming, low latency
- **Cons:** Paid service (~$0.006/minute)
- **Setup:** Just add `ASSEMBLYAI_API_KEY`

#### Google Cloud STT
- **Pros:** High quality, reliable, good language support
- **Cons:** Requires Google Cloud setup, paid service
- **Setup:** Configure `GOOGLE_APPLICATION_CREDENTIALS`

#### Local Faster-Whisper  
- **Pros:** Free, runs locally, privacy-friendly
- **Cons:** Higher latency, requires separate service and Docker
- **Setup:** Run whisper service (see Optional Docker section below) - **Not recommended unless you specifically need it**

### TTS (Text-to-Speech)

#### Google Cloud TTS Neural2 (Recommended)
- **Pros:** Natural voices, good quality
- **Cons:** Paid service (~$16 per 1M characters)
- **Setup:** Configure `GOOGLE_APPLICATION_CREDENTIALS`

#### Piper (Local)
- **Pros:** Free, runs locally, fast
- **Cons:** Requires installation, voice quality varies
- **Setup:**

```bash
pip install piper-tts
# Download models from https://github.com/rhasspy/piper/releases
```

### Guest LLM

#### Groq (Recommended for speed)
- **Model:** `llama-3.3-70b-versatile`
- **Pros:** Very fast inference, free tier
- **Setup:** Sign up at groq.com

#### Together.ai
- **Pros:** Many model options
- **Setup:** Sign up at together.ai

#### Local llama.cpp
- **Pros:** Free, private, offline
- **Cons:** Slower, requires powerful hardware and Docker
- **Setup:** See Optional Docker section - **Not recommended, use Groq instead**

---

## 🐳 Optional: Docker Deployment

**⚠️ Docker is NOT required!** The system works perfectly without it. 

Docker is only useful if you want to run:
- Local Whisper STT service (instead of AssemblyAI/Google)
- Local llama.cpp LLM (instead of Groq/Together.ai)

**For 99% of users**: Just use the cloud APIs (AssemblyAI, Groq) - they're faster and easier!

### If You Really Want Docker: Basic Setup

```bash
# Edit .env file with your API keys
cp apps/backend/.env.example apps/backend/.env

# Start services (backend + frontend only, no Docker needed for these!)
docker-compose up -d backend frontend

# View logs
docker-compose logs -f
```

### Optional: Add Local Whisper STT (Requires Docker)

```bash
# Activate the whisper service profile
docker-compose --profile local-stt up -d

# Configure backend to use it
STT_PROVIDER=whisper
```

### Optional: Add Local LLM (Requires Docker)

```bash
# Download a GGUF model first
mkdir -p models
# Download your model to ./models/

# Start with local LLM profile
docker-compose --profile local-llm up -d

# Configure backend
GUEST_PROVIDER=local
LOCAL_LLAMA_ENDPOINT=http://llama-service:8080/v1
```

**Recommendation**: Skip Docker and use:
- **STT**: AssemblyAI (best quality, real-time)
- **TTS**: Google Neural2 (natural voices)
- **Guest LLM**: Groq (extremely fast, free tier)

## Recording Configuration

Recordings are saved to `./recordings/<episode-id>/`:
- `you.webm` - Your audio track
- `claude.webm` - Claude's audio track
- `guest.webm` - Guest AI's audio track
- `you.vtt` - Your captions
- `claude.vtt` - Claude's captions
- `guest.vtt` - Guest's captions
- `events.jsonl` - Complete event log
- `session.yml` - Session metadata

## Briefing Files

Create episode briefings in `./briefings/`:

```markdown
---
title: Episode Title
topic: Main Topic
tone: conversational, technical
mustCover: [point1, point2, point3]
targetDuration: 1200
---

# Episode Briefing

Your briefing content here...
```

See `briefings/example-episode.md` for a template.

## Cost Estimates (20-minute episode)

| Configuration | Estimated Cost |
|---------------|----------------|
| AssemblyAI + Google TTS + Claude Haiku + Groq | $0.30-0.35 |
| Google STT + Google TTS + Claude Haiku + Groq | $0.25-0.30 |
| Local Whisper + Piper + Claude Haiku + Local LLM | $0.08 (Claude only) |

## Troubleshooting

### "Cannot find module" errors
Run `pnpm install` in the root directory.

### Google Cloud authentication errors
Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to a valid JSON file.

### Whisper service not starting
Check that faster-whisper is installed: `pip install faster-whisper`

### Poor audio quality
- Check microphone settings
- Ensure sample rate is 48kHz for recording
- Use wired connection for lower latency

### High latency
- Use AssemblyAI for STT (fastest)
- Use Groq for guest LLM (fastest inference)
- Ensure good internet connection for cloud APIs

## Development Tips

1. **Start with mock adapters** to test the flow before adding real APIs
2. **Use AssemblyAI + Groq** for the best balance of speed and cost
3. **Monitor events.jsonl** to debug timing issues
4. **Test briefing prompts** by checking LLM responses align with your goals
5. **Run locally first** before deploying with Docker

## Next Steps

- [ ] Test end-to-end conversation flow
- [ ] Customize Claude and guest system prompts
- [ ] Create your first briefing file
- [ ] Record a test episode
- [ ] Review recordings and captions
- [ ] Import into video editor (Premiere/Resolve)
