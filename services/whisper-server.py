#!/usr/bin/env python3
"""
Simple faster-whisper HTTP server for STT
Usage with Docker Compose or standalone
"""
import os
from fastapi import FastAPI, Request
from faster_whisper import WhisperModel
import numpy as np
import uvicorn

app = FastAPI()

# Load model on startup
model_size = os.getenv("MODEL_SIZE", "base")
device = os.getenv("DEVICE", "cpu")
compute_type = os.getenv("COMPUTE_TYPE", "int8")

print(f"Loading Whisper model: {model_size} on {device}")
model = WhisperModel(model_size, device=device, compute_type=compute_type)
print("Model loaded successfully")

@app.post("/transcribe")
async def transcribe(request: Request):
    """
    Transcribe audio chunk sent as raw PCM data
    Expected format: 16-bit PCM, 16kHz, mono
    """
    try:
        # Read raw audio data
        audio_data = await request.body()
        
        # Convert bytes to numpy array (assuming 16-bit PCM)
        audio_array = np.frombuffer(audio_data, dtype=np.int16)
        
        # Normalize to [-1, 1]
        audio_float = audio_array.astype(np.float32) / 32768.0
        
        # Transcribe
        segments, info = model.transcribe(
            audio_float,
            language="en",
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        
        # Collect all segments
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text)
        
        full_text = " ".join(text_parts).strip()
        
        return {
            "text": full_text,
            "is_final": True,
            "language": info.language,
            "language_probability": info.language_probability
        }
    
    except Exception as e:
        return {
            "text": "",
            "is_final": True,
            "error": str(e)
        }

@app.get("/health")
async def health():
    return {"status": "ok", "model": model_size, "device": device}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
