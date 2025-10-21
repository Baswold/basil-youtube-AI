# ✅ No Docker Required!

## Quick Summary

**You do NOT need Docker to run this project!** Everything works perfectly with just Node.js and pnpm.

---

## 🚀 How to Run (Without Docker)

### Step 1: Install Prerequisites
```bash
# Check you have Node.js 20+
node --version

# Install pnpm if you don't have it
npm install -g pnpm
```

### Step 2: Install and Run
```bash
# Clone and install
cd basil_youtube_thing
pnpm install

# Start everything (takes ~5 seconds)
pnpm dev
```

That's it! Open http://localhost:3000 and you're good to go! 🎉

---

## 🎯 What Runs Without Docker

### Development Mode (Mock Adapters)
- ✅ **Frontend** - Next.js UI with ElevenLabs orbs
- ✅ **Backend** - Express + Socket.IO server
- ✅ **Mock adapters** - Simulate STT/TTS/LLM for testing
- ✅ **WebSocket communication** - Real-time updates
- ✅ **All features** - Autopilot, captions, orb animations

**No configuration needed!** Just `pnpm dev` and it works.

### Production Mode (Real APIs - No Docker!)
When you're ready for real AI services:

1. **Get API keys** (all free tiers available):
   - Anthropic (Claude): https://console.anthropic.com
   - AssemblyAI (STT): https://www.assemblyai.com
   - Groq (Fast LLM): https://groq.com

2. **Add to .env file**:
```bash
cp apps/backend/.env.example apps/backend/.env
# Edit .env with your keys
USE_REAL_ADAPTERS=true
ANTHROPIC_API_KEY=sk-ant-...
ASSEMBLYAI_API_KEY=...
GROQ_API_KEY=gsk_...
```

3. **Run**:
```bash
pnpm dev
```

Still no Docker needed! All APIs are cloud-based.

---

## 🐳 When Would You Need Docker?

Docker is **ONLY** needed for these optional local services:

### 1. Local Whisper STT (Instead of AssemblyAI)
❌ **Not recommended** - AssemblyAI is faster and better
- Requires: Docker, GPU (for good performance), 4GB+ RAM
- Setup: Complex
- Why skip: AssemblyAI is free tier + better quality

### 2. Local LLM (Instead of Groq/Together.ai)
❌ **Not recommended** - Groq is much faster
- Requires: Docker, GPU, 16GB+ RAM, large model downloads
- Setup: Very complex
- Why skip: Groq has free tier + 10x faster

### 3. Containerized Deployment
✅ **Optional** - Only for production deployment
- Use if: Deploying to Kubernetes, cloud containers, etc.
- Alternative: Just run `node dist/index.js` - no Docker needed!

---

## 📊 Comparison: Docker vs No Docker

| Feature | Without Docker | With Docker |
|---------|---------------|-------------|
| **Setup Time** | 2 minutes | 20+ minutes |
| **Dependencies** | Node.js + pnpm | Docker + images + builds |
| **STT Quality** | AssemblyAI (excellent) | Whisper (good, slower) |
| **LLM Speed** | Groq (extremely fast) | Local (slow) |
| **Cost** | Free tiers available | Free but hardware intensive |
| **Complexity** | Simple | Complex |
| **Recommended** | ✅ YES | ❌ NO (unless specific needs) |

---

## 💡 Recommended Setup (No Docker)

```bash
# 1. Install
pnpm install

# 2. Development (mock mode)
pnpm dev

# 3. Production (when ready)
# Add API keys to .env:
# - ANTHROPIC_API_KEY (Claude)
# - ASSEMBLYAI_API_KEY (STT)
# - GROQ_API_KEY (Guest LLM)

pnpm dev
```

**Total time**: 5 minutes
**Docker needed**: ❌ NO
**Works perfectly**: ✅ YES

---

## 🎓 Why This Approach is Better

### 1. Faster to Start
- No Docker installation
- No image downloads
- No container builds
- Just `pnpm install` and `pnpm dev`

### 2. Easier to Develop
- Hot reload works instantly
- No container restarts
- Direct file access
- Simpler debugging

### 3. Better Performance
- Cloud APIs are optimized
- No local GPU needed
- Lower memory usage
- Faster responses

### 4. Cheaper
- Free tiers for all services
- No cloud compute costs
- No GPU needed
- Pay only for what you use

---

## 🚨 Common Misconceptions

### "I need Docker for production"
❌ **FALSE** - Production Node.js apps don't need Docker
- Just run `node dist/index.js`
- Deploy to Vercel, Railway, Fly.io, etc.
- Docker is optional, not required

### "Docker is faster"
❌ **FALSE** - Cloud APIs are much faster
- Groq: ~50 tokens/second
- Local LLM: ~5 tokens/second
- AssemblyAI: Real-time streaming
- Local Whisper: 5-10 second delay

### "I need Docker for local development"
❌ **FALSE** - Mock adapters work perfectly
- Test all features
- No API keys needed
- Instant startup
- Fast development

---

## ✅ Summary

**You do NOT need Docker!**

- ✅ Development works without Docker (mock adapters)
- ✅ Production works without Docker (cloud APIs)
- ✅ Deployment works without Docker (standard Node.js)
- ✅ Everything is faster without Docker
- ✅ Everything is simpler without Docker

**Docker is only useful for**:
- Running local Whisper STT (not recommended)
- Running local LLM (not recommended)
- Kubernetes deployments (advanced use case)

**For 99% of users**: Skip Docker entirely! ✨

---

## 🎯 Quick Start Commands

```bash
# Installation
pnpm install

# Development (mock mode - no config needed)
pnpm dev

# Run tests
cd apps/backend && pnpm test

# Build for production
pnpm --filter basil-backend build
pnpm --filter frontend build

# Start production
pnpm start
```

**Docker commands needed**: ZERO ✅

---

**Your machine can't run Docker? Perfect! You don't need it!** 🎉
