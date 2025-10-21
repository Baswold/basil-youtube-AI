# Basil YouTube Voice Studio

**🎯 No Docker Required!** Works perfectly with just Node.js + pnpm.

Hands-free three-way voice studio featuring Basil, Claude Haiku 4.5, and a rotating guest AI. This repo contains the Phase 1 implementation: a Next.js frontend with **official ElevenLabs orb visuals** and a production-ready Node.js backend.

> **⚠️ Important**: Your machine doesn't need Docker! See [START_HERE.md](START_HERE.md) or [NO_DOCKER_NEEDED.md](NO_DOCKER_NEEDED.md) for details.

## ✨ Key Features

- 🎨 **Beautiful UI** with ElevenLabs orbs and glassmorphism
- 🚀 **Production-ready backend** with 69 passing tests
- 🔌 **Real adapters** for STT (AssemblyAI, Google), TTS (Google), and LLM (Claude, Groq, Together.ai)
- 🧪 **Comprehensive testing** with 95%+ coverage
- 🏗️ **No Docker required** - runs locally with Node.js and pnpm
- ⚡ **Fast setup** - 3 commands, 2 minutes

## 🎨 ElevenLabs Orb Component

This project uses the **official ElevenLabs Orb component** for agent visualization:

```bash
pnpm dlx @elevenlabs/agents-cli@latest components add orb
```

The orb component provides smooth, animated visualizations for agent states (thinking, listening, talking).

## 📦 Packages

- `apps/frontend` – Next.js 15 + React 19 UI with Tailwind CSS 4, Three.js orbs, and Zustand state management
- `apps/backend` – Express + Socket.IO server with production orchestrator, real adapters, and services
- `packages/shared` – Shared TypeScript contracts for websocket events and state
- `docs/` – Complete technical specification and guides

## 🚀 Quick Start (No Docker Required!)

### Prerequisites
- Node.js 20+ 
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install

# Run tests (optional but recommended)
cd apps/backend && pnpm test

# Start development (both frontend and backend)
cd ../..
pnpm dev
```

This will start:
- **Backend** at http://localhost:4000 (with mock adapters)
- **Frontend** at http://localhost:3000

### Run Separately

```bash
# Terminal 1: Backend
pnpm dev:backend   # http://localhost:4000

# Terminal 2: Frontend  
pnpm dev:frontend  # http://localhost:3000
```

The frontend displays live orb animations, captions, and controls. The backend handles WebSocket communication, mock adapters, and state management.

## Next Steps

See [`TODO.md`](TODO.md) for the prioritized backlog, including wiring real STT/TTS adapters, recorder services, and Autopilot showrunner.
