import type { SpeakerId } from "@basil/shared";
import type { TtsAdapter } from "./interfaces.js";

interface CoquiConfig {
  speaker?: Exclude<SpeakerId, "you">;
  modelName?: string;
  speakerIdx?: string;
  speakingRate?: number;

  // EchoForge integration
  echoforgeEndpoint?: string;  // e.g., "http://localhost:8000"
  voiceProfileId?: number;      // EchoForge voice profile ID
  voiceProfileName?: string;    // Alternative: use profile name

  onAudioChunk?: (sessionId: string, speaker: Exclude<SpeakerId, "you">, audioChunk: Buffer) => void;
  onComplete?: (sessionId: string, speaker: Exclude<SpeakerId, "you">) => void;
  onError?: (sessionId: string, speaker: Exclude<SpeakerId, "you">, error: Error) => void;
}

/**
 * Adapter for Coqui TTS - supports both local VCTK and EchoForge voice cloning.
 *
 * MODE 1: Local VCTK (original behavior)
 *   Install with: pip install coqui-tts
 *   Model: tts_models/en/vctk/vits (automatically downloaded)
 *
 * MODE 2: EchoForge integration (recommended for custom voices)
 *   Configure echoforgeEndpoint + voiceProfileId to use EchoForge API
 *   Example: { echoforgeEndpoint: "http://localhost:8000", voiceProfileId: 1 }
 */
export class CoquiTtsAdapter implements TtsAdapter {
  private config: CoquiConfig;
  private activeSessions = new Set<string>();

  constructor(config: CoquiConfig = {}) {
    this.config = {
      modelName: "tts_models/en/vctk/vits",
      speakingRate: 1.0,
      echoforgeEndpoint: process.env.ECHOFORGE_ENDPOINT || "http://localhost:8000",
      ...config,
    };
  }

  async synthesize(sessionId: string, text: string): Promise<void> {
    if (this.activeSessions.has(sessionId)) {
      console.warn(`[coqui-tts] session ${sessionId} already synthesizing`);
      return;
    }

    this.activeSessions.add(sessionId);

    try {
      // Check if EchoForge integration is configured
      if (this.config.echoforgeEndpoint && this.config.voiceProfileId) {
        await this.runEchoForge(sessionId, text);
      } else {
        await this.runCoqui(sessionId, text);
      }
    } catch (error) {
      console.error(`[coqui-tts] error for ${sessionId}:`, error);
      this.config.onError?.(sessionId, this.config.speaker ?? "claude", error as Error);
    } finally {
      this.activeSessions.delete(sessionId);
    }
  }

  async stop(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
    console.info(`[coqui-tts] stopped ${sessionId}`);
  }

  private async runCoqui(sessionId: string, text: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // For now, we'll use a simple approach - generate file and stream chunks
        // In a production system, you'd want to use the Python API directly

        // Use Python to generate audio file
        const { spawn } = await import("child_process");
        const { promisify } = await import("util");
        const execFile = promisify((await import("child_process")).execFile);

        const outputPath = `/tmp/coqui_${sessionId}_${Date.now()}.wav`;

        // Use tts command line tool
        const args = [
          "--text", text,
          "--model_name", this.config.modelName!,
          "--out_path", outputPath
        ];

        if (this.config.speakerIdx) {
          args.push("--speaker", this.config.speakerIdx);
        }

        console.log(`[coqui-tts] Running: tts ${args.join(' ')}`);

        const { stdout, stderr } = await execFile("tts", args);

        if (stderr) {
          console.warn(`[coqui-tts] stderr: ${stderr}`);
        }

        // Read the generated file and stream it in chunks
        const fs = await import("fs");
        const audioBuffer = fs.readFileSync(outputPath);

        // Split into chunks for streaming (simulate real-time)
        const chunkSize = 1024;
        for (let i = 0; i < audioBuffer.length; i += chunkSize) {
          const chunk = audioBuffer.slice(i, i + chunkSize);
          this.config.onAudioChunk?.(sessionId, this.config.speaker ?? "claude", chunk);
        }

        // Clean up temporary file
        fs.unlinkSync(outputPath);

        this.config.onComplete?.(sessionId, this.config.speaker ?? "claude");
        resolve();

      } catch (error) {
        console.error(`[coqui-tts] Python execution failed:`, error);
        reject(error);
      }
    });
  }

  private async runEchoForge(sessionId: string, text: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`[echoforge-tts] Calling EchoForge API for ${sessionId}...`);

        // Prepare form data for the request
        const FormData = (await import("form-data")).default;
        const form = new FormData();
        form.append("text", text);
        form.append("voice_profile_id", this.config.voiceProfileId!.toString());
        form.append("language", "en");
        form.append("speed", this.config.speakingRate?.toString() || "1.0");

        // Call EchoForge real-time synthesis endpoint
        const fetch = (await import("node-fetch")).default;
        const response = await fetch(
          `${this.config.echoforgeEndpoint}/api/synthesize/realtime`,
          {
            method: "POST",
            body: form,
            headers: form.getHeaders(),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`EchoForge API error: ${response.status} - ${errorText}`);
        }

        // Get the audio file as a buffer
        const audioBuffer = Buffer.from(await response.arrayBuffer());

        console.log(`[echoforge-tts] Received ${audioBuffer.length} bytes from EchoForge`);

        // Stream the audio in chunks to match the interface
        const chunkSize = 4096;
        for (let i = 0; i < audioBuffer.length; i += chunkSize) {
          const chunk = audioBuffer.slice(i, i + chunkSize);
          this.config.onAudioChunk?.(sessionId, this.config.speaker ?? "claude", chunk);
        }

        this.config.onComplete?.(sessionId, this.config.speaker ?? "claude");
        resolve();

      } catch (error) {
        console.error(`[echoforge-tts] API call failed:`, error);
        reject(error);
      }
    });
  }
}

// Voice presets for different speakers using VCTK dataset
export function createClaudeCoquiVoice(speakerIdx?: string): CoquiTtsAdapter {
  return new CoquiTtsAdapter({
    speaker: "claude",
    modelName: "tts_models/en/vctk/vits",
    speakerIdx: speakerIdx || "VCTK_p226", // 22 year old male, English accent (Surrey)
    speakingRate: 1.05,
  });
}

export function createGuestCoquiVoice(speakerIdx?: string): CoquiTtsAdapter {
  return new CoquiTtsAdapter({
    speaker: "guest",
    modelName: "tts_models/en/vctk/vits",
    speakerIdx: speakerIdx || "VCTK_p225", // 23 year old female, English accent
    speakingRate: 1.0,
  });
}

// Helper function to get available speakers
export async function getCoquiSpeakers(): Promise<string[]> {
  try {
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync("tts", [
      "--model_name", "tts_models/en/vctk/vits",
      "--list_speaker_idxs"
    ]);

    return stdout.trim().split('\n').filter(s => s.trim());
  } catch (error) {
    console.error("Failed to get Coqui speakers:", error);
    return [];
  }
}
