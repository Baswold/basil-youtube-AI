# 🎤 Piper TTS Voice Tester

A simple web dashboard to test the local Piper TTS engine and compare different voices.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Piper (if not already installed)

```bash
pip install piper-tts
```

### 3. Download Voice Models

Download the voice models from the [Piper releases page](https://github.com/rhasspy/piper/releases):

- `en_US-lessac-medium.onnx` (Claude voice)
- `en_US-libritts-high.onnx` (Guest voice)

Create a `models` directory in this folder and place the downloaded `.onnx` files there:

```bash
mkdir models
# Place .onnx files in models/
```

Or set the `PIPER_MODEL_PATH` environment variable to point to your models directory.

### 4. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3001`

### 5. Open in Browser

Open your browser and navigate to:
```
http://localhost:3001
```

## Usage

1. **Enter text** - Type or paste the text you want to hear
2. **Select a voice**:
   - **Claude Voice**: Uses the `en_US-lessac-medium.onnx` model (warm, professional)
   - **Guest Voice**: Uses the `en_US-libritts-high.onnx` model (clear, engaging)
3. **Click Synthesize** - The TTS engine will generate speech
4. **Listen** - The audio player will appear with the generated speech

## Environment Variables

```bash
# Path to the Piper binary (default: "piper")
PIPER_PATH=piper

# Path to the Piper models directory (default: "./models")
PIPER_MODEL_PATH=./models
```

Example:
```bash
PIPER_PATH=/usr/local/bin/piper PIPER_MODEL_PATH=~/piper_models npm start
```

## API Endpoint

The server exposes a simple REST API:

### POST `/api/tts/synthesize`

Synthesize speech from text.

**Request:**
```json
{
  "text": "Hello, this is a test",
  "voice": "claude"
}
```

**Response:**
- Content-Type: `audio/wav`
- Body: WAV audio file

**Example with curl:**
```bash
curl -X POST http://localhost:3001/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","voice":"claude"}' \
  --output output.wav
```

### GET `/api/health`

Check server status and Piper availability.

**Response:**
```json
{
  "status": "ok",
  "piper": {
    "available": true,
    "path": "piper",
    "modelPath": "./models"
  },
  "voices": ["claude", "guest"]
}
```

## Troubleshooting

### "Piper TTS engine not found"

Make sure Piper is installed:
```bash
pip install piper-tts
piper --version
```

### "Model not found"

Ensure the voice models are in the correct location:
- Default: `./models/` (relative to this directory)
- Or set `PIPER_MODEL_PATH` environment variable

Download from: https://github.com/rhasspy/piper/releases

### "Command not found: piper"

If Piper is installed but not in PATH, you can specify the full path:
```bash
PIPER_PATH=/usr/local/bin/piper npm start
```

## Development

Run with auto-reload on file changes:
```bash
npm run dev
```

## Notes

- This is a standalone testing tool separate from the main backend
- It uses the Piper TTS engine for local speech synthesis
- No internet connection required (once models are downloaded)
- Supports local-only testing without API keys
