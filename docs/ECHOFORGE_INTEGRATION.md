# EchoForge Integration Guide

This guide explains how to integrate the Voice Studio with EchoForge for custom voice cloning.

## Overview

The Voice Studio can now use **custom cloned voices** from your EchoForge platform instead of generic TTS voices. This gives you:

- **Your actual voice** for Basil (the host)
- **A cloned voice for Claude** (your AI co-host)
- **Custom guest voices** for different AI personalities

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│  Voice Studio       │         │  EchoForge Platform  │
│  (basil_youtube)    │  HTTP   │  (voice-custom...)   │
│                     │────────▶│                      │
│  - Frontend UI      │         │  - Voice Cloning     │
│  - Backend Orche    │         │  - XTTS v2 Engine    │
│  - TTS Adapters     │◀────────│  - Voice Profiles    │
│                     │  Audio  │                      │
└─────────────────────┘         └──────────────────────┘
```

## Setup Instructions

### Step 1: Install Both Platforms

#### EchoForge (Voice Cloning Platform)
```bash
cd ~/Documents/voice-custom-startup-thing
./install-mac.sh
```

#### Voice Studio (Conversation Director)
```bash
cd ~/Documents/basil_youtube_thing
pnpm install
```

### Step 2: Create Voice Profiles in EchoForge

1. Start EchoForge backend:
   ```bash
   cd ~/Documents/voice-custom-startup-thing
   source backend/venv/bin/activate
   cd backend
   uvicorn app.main:app --reload
   ```

2. Start EchoForge frontend:
   ```bash
   cd ~/Documents/voice-custom-startup-thing/frontend
   npm run dev
   ```

3. Open http://localhost:3000 and create voice profiles:
   - **Basil** (your voice) - Record consent phrase + reference audio
   - **Claude** (co-host voice) - Record or upload reference audio
   - **Guest voices** (optional) - For different AI personalities

4. Note the **Voice Profile IDs** (shown in the UI, e.g., Profile #1, #2, etc.)

### Step 3: Configure Voice Studio

Create or edit `.env` file in Voice Studio backend:

```bash
cd ~/Documents/basil_youtube_thing/apps/backend
cat > .env << 'EOF'
# TTS Provider - use "coqui" for EchoForge integration
TTS_PROVIDER=coqui

# EchoForge Configuration
ECHOFORGE_ENDPOINT=http://localhost:8000
CLAUDE_VOICE_PROFILE_ID=1   # ID of Claude's voice profile
GUEST_VOICE_PROFILE_ID=2    # ID of guest's voice profile

# If not using EchoForge, Coqui will fall back to local VCTK voices

# Other settings...
ANTHROPIC_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
EOF
```

### Step 4: Test the Integration

1. **Start EchoForge** (if not already running):
   ```bash
   cd ~/Documents/voice-custom-startup-thing/backend
   source venv/bin/activate
   uvicorn app.main:app --reload --port 8000
   ```

2. **Start Voice Studio backend**:
   ```bash
   cd ~/Documents/basil_youtube_thing
   pnpm dev:backend
   ```

3. **Start Voice Studio frontend**:
   ```bash
   cd ~/Documents/basil_youtube_thing
   pnpm dev:frontend
   ```

4. **Open Voice Studio**: http://localhost:3000

5. **Start a conversation** - Claude and Guest should now speak with your custom cloned voices!

## How It Works

### Real-Time Synthesis Flow

1. **User speaks** → STT → Transcript
2. **Claude responds** → LLM generates text
3. **Voice synthesis**:
   - If `CLAUDE_VOICE_PROFILE_ID` is set → Call EchoForge API
   - EchoForge synthesizes with cloned voice → Returns audio
   - Voice Studio streams audio → User hears Claude's custom voice

### API Call Flow

```javascript
// Voice Studio TTS Adapter
POST http://localhost:8000/api/synthesize/realtime
Content-Type: multipart/form-data

text: "Hello, I'm Claude!"
voice_profile_id: 1
language: en
speed: 1.0

// Response: Audio file (WAV format)
```

## Configuration Options

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TTS_PROVIDER` | TTS engine ("google" or "coqui") | `coqui` |
| `ECHOFORGE_ENDPOINT` | EchoForge API URL | `http://localhost:8000` |
| `CLAUDE_VOICE_PROFILE_ID` | Voice profile ID for Claude | `1` |
| `GUEST_VOICE_PROFILE_ID` | Voice profile ID for guest | `2` |

### Runtime Configuration (via API)

You can also configure voices at runtime using the settings API:

```bash
# Update guest voice to use EchoForge profile #3
curl -X POST http://localhost:4000/api/config/guest \
  -H "Content-Type: application/json" \
  -d '{
    "guestProvider": "groq",
    "guestVoiceProfileId": 3
  }'
```

## Troubleshooting

### "Voice profile not found"
- Verify the voice profile ID exists in EchoForge
- Check that EchoForge is running on port 8000
- Ensure consent has been verified for the voice profile

### "Connection refused"
- Make sure EchoForge backend is running: `uvicorn app.main:app --reload --port 8000`
- Check that `ECHOFORGE_ENDPOINT` matches the running port

### "Synthesis too slow"
- XTTS v2 generates audio in real-time (~1-2 seconds for short sentences)
- For GPU acceleration: Ensure CUDA/MPS is available
- Check EchoForge logs for device info (should show "mps" on Apple Silicon)

### Fallback to Local Voices
If EchoForge is unavailable, the system automatically falls back to local VCTK voices:
- Claude: VCTK_p226 (22yo male, English accent)
- Guest: VCTK_p225 (23yo female, English accent)

## Voice Profile Management

### Creating Personas with Custom Voices

In Voice Studio settings, you can create personas that use specific EchoForge voices:

1. Open Settings → Guest Personas
2. Create new persona
3. Set voice provider to "EchoForge"
4. Enter voice profile ID from EchoForge
5. Save and invite to show

### Voice Quality Tips

For best results with voice cloning:
- Use 30-60 seconds of clear reference audio
- Record in a quiet environment
- Speak naturally and expressively
- Include varied intonation and pacing

## Advanced: Multiple Voice Profiles

You can create different voices for different show formats:

```bash
# Tech deep-dive episodes
CLAUDE_VOICE_PROFILE_ID=1  # Professional, measured tone
GUEST_VOICE_PROFILE_ID=2   # Curious, questioning tone

# Casual explanation episodes
CLAUDE_VOICE_PROFILE_ID=3  # Friendly, conversational
GUEST_VOICE_PROFILE_ID=4   # Skeptical, challenging
```

## Performance Notes

- **First synthesis**: 3-5 seconds (model loading)
- **Subsequent synthesis**: 1-2 seconds per sentence
- **Memory usage**: ~2GB for XTTS v2 model
- **GPU acceleration**: Supported (CUDA, MPS)

## Next Steps

1. ✅ Create voice profiles in EchoForge
2. ✅ Configure Voice Studio with profile IDs
3. ✅ Test real-time conversations
4. 🎯 Fine-tune voices for better quality (optional)
5. 🎯 Create multiple personas for different show formats
6. 🎯 Export recordings for video editing

## Support

If you encounter issues:
1. Check logs in both platforms
2. Verify API connectivity: `curl http://localhost:8000/health`
3. Ensure voice profiles have verified consent
4. Review this guide's troubleshooting section

---

**Happy voice cloning!** 🎙️
