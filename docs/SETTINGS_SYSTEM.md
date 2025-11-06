# Settings & Guest Persona System 🎛️

## Overview

A comprehensive settings management system that allows you to configure API keys, create and manage guest AI personas, and customize voice settings through a user-friendly interface.

---

## Features

### 1. API Key Management

Store and manage API keys for all AI services:

- **Claude API (Required)** - Used for Claude Haiku 4.5 (always enabled)
- **AssemblyAI** - Real-time speech-to-text transcription
- **Groq** - Fast guest AI inference (Llama 3.3 70B)
- **Together.ai** - Alternative guest AI provider  
- **OpenAI** - Alternative guest AI provider (GPT-4, etc.)

**Storage**: API keys are stored in browser localStorage and sent to backend on save.

### 2. Guest Persona System

Create, save, and reuse guest AI personas with custom:

- **Name** - e.g., "Technical Expert", "Devil's Advocate"
- **AI Provider** - Groq, Together.ai, OpenAI, or Local LLM
- **Model** - e.g., `llama-3.3-70b-versatile`, `gpt-4`
- **System Instructions** - Define the persona's role, tone, and behavior
- **Voice** - Choose from Google TTS voices or Piper TTS models
- **Colors** - Custom orb gradient colors (saved but not yet wired)

**Actions**:
- ✨ **Create** - Design a new persona from scratch
- ✏️ **Edit** - Modify existing personas
- 📺 **Invite** - Apply a persona to the current episode
- 🗑️ **Delete** - Remove personas you no longer need

### 3. Voice Customization

#### Google TTS Voices (Cloud)
- Male - Clear & Engaging (Neural2-A)
- Male - Warm & Professional (Neural2-D)
- Female - Warm & Confident (Neural2-F)
- Female - Clear & Natural (Neural2-G)
- Female - Energetic (Neural2-H)
- Male - Deep & Authoritative (Neural2-I)
- Male - Friendly (Neural2-J)

Custom settings: `speakingRate`, `pitch`

#### Piper TTS Models (Local)
- Lessac - Medium Quality
- LibriTTS - High Quality
- Amy - Medium Quality

Custom settings: `speakingRate`

---

## How to Use

### Step 1: Add API Keys

1. Click **⚙️ Settings** in the studio header
2. Go to **🔑 API Keys** tab
3. Enter your API keys (at minimum, Claude API key is required)
4. Click **💾 Save API Keys**

Keys are stored locally and sent to the backend.

### Step 2: Create a Guest Persona

1. Click **⚙️ Settings** → **👥 Guest Personas** tab
2. Click **✨ Create New Persona**
3. Fill in:
   - **Persona Name** - Give it a descriptive name
   - **AI Provider** - Choose Groq (fast), Together.ai, OpenAI, or Local
   - **Model** (Optional) - Specify a custom model
   - **System Instructions** - Define the persona's behavior
   - **Voice Provider** - Google TTS (cloud) or Piper (local)
   - **Voice** - Select from available voices
4. Click **💾 Save Persona**

### Step 3: Invite a Guest to the Show

1. In **👥 Guest Personas** tab, find your saved persona
2. Click **📺 Invite** button
3. The backend will update runtime configuration
4. Start your episode - the guest will use the invited persona

---

## Technical Implementation

### Frontend

**Files Added**:
- `apps/frontend/src/components/settings-modal.tsx` - Settings UI component
- `packages/shared/src/persona-types.ts` - TypeScript types for personas & config

**Integration**:
- Settings button in studio header opens modal
- Personas stored in `localStorage` as `guestPersonas`
- API keys stored in `localStorage` as `apiKeys`

### Backend

**Files Added**:
- `apps/backend/src/api-routes.ts` - REST API endpoints for configuration

**Endpoints**:

#### `POST /api/config/keys`
Update API keys at runtime
```json
{
  "anthropicApiKey": "sk-ant-...",
  "assemblyaiApiKey": "...",
  "groqApiKey": "gsk_...",
  "togetherApiKey": "...",
  "openaiApiKey": "sk-..."
}
```

#### `POST /api/config/guest`
Update guest configuration (persona invitation)
```json
{
  "guestProvider": "groq",
  "guestModel": "llama-3.3-70b-versatile",
  "guestSystemInstructions": "You are...",
  "guestVoice": {
    "provider": "google",
    "googleVoice": "en-US-Neural2-A",
    "speakingRate": 1.0,
    "pitch": 0.5
  }
}
```

#### `GET /api/config`
Retrieve current configuration
```json
{
  "useRealAdapters": true,
  "sttProvider": "assemblyai",
  "ttsProvider": "google",
  "guestProvider": "groq",
  "guestModel": "llama-3.3-70b-versatile",
  "runtimeConfig": { ... }
}
```

### Adapter Factory Enhancements

**File Modified**: `apps/backend/src/adapters/factory.ts`

**New Config Fields**:
```typescript
interface FactoryConfig {
  // Guest voice customization
  guestVoiceProvider?: "google" | "piper";
  guestGoogleVoice?: string;
  guestPiperModel?: string;
  guestSpeakingRate?: number;
  guestPitch?: number;
}
```

**New Method**:
```typescript
guestTts(): TtsAdapter
```
Creates a TTS adapter with custom guest voice settings.

---

## Data Flow

### 1. Persona Creation Flow
```
User fills form → Save to localStorage → Display in persona list
```

### 2. Persona Invitation Flow
```
User clicks "Invite" 
→ POST /api/config/guest with persona settings
→ Backend updates runtimeConfig
→ Orchestrator uses new config for next episode
```

### 3. API Key Update Flow
```
User enters keys → Save to localStorage
→ POST /api/config/keys
→ Backend updates appConfig
→ New adapter instances use updated keys
```

---

## Storage

### LocalStorage Keys

**`guestPersonas`** (array):
```json
[
  {
    "id": "1234567890",
    "name": "Technical Expert",
    "provider": "groq",
    "model": "llama-3.3-70b-versatile",
    "systemInstructions": "You are a technical expert...",
    "voice": {
      "provider": "google",
      "googleVoice": "en-US-Neural2-D",
      "speakingRate": 1.05,
      "pitch": -1.0
    },
    "colors": ["#F59E0B", "#F97316"],
    "createdAt": 1234567890,
    "lastUsed": 1234567891
  }
]
```

**`apiKeys`** (object):
```json
{
  "anthropicApiKey": "sk-ant-...",
  "assemblyaiApiKey": "...",
  "groqApiKey": "gsk_...",
  "togetherApiKey": "...",
  "openaiApiKey": "sk-..."
}
```

---

## Future Enhancements

### Planned
- [ ] Import/export personas as JSON files
- [ ] Persona templates library
- [ ] Voice preview/testing before saving
- [ ] Persona tags and search
- [ ] Usage analytics per persona
- [ ] Collaborative persona sharing

### Possible
- [ ] Cloud sync for personas (optional)
- [ ] A/B testing different personas
- [ ] Persona performance metrics
- [ ] Voice cloning integration
- [ ] Multi-language support

---

## Security Notes

### API Keys
- Stored in browser localStorage (client-side only)
- Transmitted over HTTPS to backend
- Backend stores in memory (not persisted to disk)
- Redacted in logs via pino-http

### Best Practices
- Never commit API keys to version control
- Use environment variables for production deployments
- Rotate keys regularly
- Use least-privilege API keys where possible

---

## Troubleshooting

### API Keys Not Working
1. Check that keys are saved (Settings → API Keys tab)
2. Verify keys are valid in provider dashboard
3. Check backend logs for authentication errors
4. Try re-entering and saving keys

### Persona Not Loading
1. Check browser console for errors
2. Verify localStorage has `guestPersonas` data
3. Check backend logs when clicking "Invite"
4. Ensure required API key for provider is set

### Voice Not Changing
1. Confirm persona was invited (not just saved)
2. Check backend received POST /api/config/guest
3. Verify `guestVoice` settings in payload
4. Start a new episode to apply changes

---

## Example: Creating a Devil's Advocate Persona

```json
{
  "name": "Devil's Advocate",
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "systemInstructions": "You are a skeptical devil's advocate who challenges every claim with rigorous logic. Ask probing questions, point out logical fallacies, and demand evidence. Be respectful but relentless in seeking truth.",
  "voice": {
    "provider": "google",
    "googleVoice": "en-US-Neural2-I",
    "speakingRate": 0.95,
    "pitch": -0.5
  },
  "colors": ["#DC2626", "#991B1B"]
}
```

---

## Summary

✅ **Complete API key management**
✅ **Save and reuse guest personas**
✅ **Customize AI provider per persona**
✅ **Custom system instructions**
✅ **Voice selection (Google & Piper)**
✅ **Runtime configuration updates**
✅ **No server restart required**

**Status**: ✨ **FULLY IMPLEMENTED** ✨

The settings system is ready for production use!
