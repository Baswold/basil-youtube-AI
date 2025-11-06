import type { Request, Response, Router } from "express";
import type { ApiKeysPayload, RuntimeConfig } from "@basil/shared";
import { appConfig } from "./config.js";

// Runtime configuration that can be updated without restarting
export let runtimeConfig: Partial<RuntimeConfig> = {};

/**
 * Setup API routes for configuration management
 */
export function setupApiRoutes(router: Router): void {
  // POST /api/config/keys - Update API keys at runtime
  router.post("/api/config/keys", (req: Request, res: Response) => {
    try {
      const keys: ApiKeysPayload = req.body;

      // Update app config with new keys
      if (keys.anthropicApiKey) {
        (appConfig as any).anthropicApiKey = keys.anthropicApiKey;
      }
      if (keys.assemblyaiApiKey) {
        (appConfig as any).assemblyaiApiKey = keys.assemblyaiApiKey;
      }
      if (keys.groqApiKey) {
        (appConfig as any).groqApiKey = keys.groqApiKey;
      }
      if (keys.grokApiKey) {
        (appConfig as any).grokApiKey = keys.grokApiKey;
      }
      if (keys.togetherApiKey) {
        (appConfig as any).togetherApiKey = keys.togetherApiKey;
      }
      if (keys.openaiApiKey) {
        (appConfig as any).openaiApiKey = keys.openaiApiKey;
      }

      console.info("[api] API keys updated");
      res.json({ success: true, message: "API keys updated successfully" });
    } catch (error) {
      console.error("[api] Error updating API keys:", error);
      res.status(500).json({ success: false, error: "Failed to update API keys" });
    }
  });

  // POST /api/config/guest - Update guest AI configuration
  router.post("/api/config/guest", (req: Request, res: Response) => {
    try {
      const config: RuntimeConfig = req.body;

      // Update runtime configuration
      if (config.guestProvider) {
        runtimeConfig.guestProvider = config.guestProvider;
        (appConfig as any).guestProvider = config.guestProvider;
      }
      if (config.guestModel) {
        runtimeConfig.guestModel = config.guestModel;
        (appConfig as any).guestModel = config.guestModel;
      }
      if (config.guestSystemInstructions) {
        runtimeConfig.guestSystemInstructions = config.guestSystemInstructions;
      }
      if (config.ttsProvider) {
        runtimeConfig.ttsProvider = config.ttsProvider;
        (appConfig as any).ttsProvider = config.ttsProvider;
      }
      if (config.guestVoice) {
        runtimeConfig.guestVoice = config.guestVoice;
      }

      console.info("[api] Guest configuration updated:", {
        provider: runtimeConfig.guestProvider,
        model: runtimeConfig.guestModel,
        ttsProvider: runtimeConfig.ttsProvider,
      });

      res.json({
        success: true,
        message: "Guest configuration updated successfully",
        config: runtimeConfig,
      });
    } catch (error) {
      console.error("[api] Error updating guest config:", error);
      res.status(500).json({ success: false, error: "Failed to update guest configuration" });
    }
  });

  // GET /api/config - Get current configuration
  router.get("/api/config", (_req: Request, res: Response) => {
    res.json({
      useRealAdapters: appConfig.useRealAdapters,
      sttProvider: appConfig.sttProvider,
      ttsProvider: appConfig.ttsProvider,
      guestProvider: appConfig.guestProvider,
      guestModel: appConfig.guestModel,
      runtimeConfig,
    });
  });

  // POST /api/tts/synthesize - TTS synthesis for dashboard
  router.post("/api/tts/synthesize", async (req: Request, res: Response) => {
    try {
      const { text, speaker } = req.body;

      if (!text || speaker === undefined) {
        return res.status(400).json({ error: "Missing text or speaker parameter" });
      }

      console.log(`[tts-synthesis] Request for speaker ${speaker}: "${text.substring(0, 50)}..."`);

      // Import factory dynamically to avoid circular dependencies
      const { RealAdapterFactory } = await import("./adapters/factory.js");

      // Create TTS adapter for this speaker (dashboard uses speaker 0-903)
      const factory = new RealAdapterFactory({
        ttsProvider: "coqui",
        guestVoiceProvider: "coqui",
      });

      const ttsAdapter = await factory.tts(speaker);

      // Generate audio using streaming approach
      const audioChunks: Buffer[] = [];

      const sessionId = `dashboard-${Date.now()}`;

      // Set up callbacks to collect audio
      const originalOnAudioChunk = ttsAdapter.synthesize;
      const synthesizePromise = new Promise<void>((resolve, reject) => {
        // Monkey patch the synthesize method to collect chunks
        const originalSynthesize = ttsAdapter.synthesize.bind(ttsAdapter);

        ttsAdapter.synthesize = async (sessionId: string, text: string) => {
          return new Promise<void>((resolveChunk, rejectChunk) => {
            // We'll need to implement chunk collection in the adapter itself
            // For now, let's use a simpler approach
            resolveChunk();
          });
        };

        originalSynthesize(sessionId, text)
          .then(() => resolve())
          .catch(reject);
      });

      // For now, let's use a simpler approach - generate the audio file directly
      const { execFile } = await import("child_process");
      const { promisify } = await import("util");
      const execFileAsync = promisify(execFile);

      const outputPath = `/tmp/dashboard_tts_${speaker}_${Date.now()}.wav`;

      const args = [
        "--text", text,
        "--model_name", "tts_models/en/vctk/vits",
        "--out_path", outputPath
      ];

      // Map dashboard speaker ID to VCTK speaker ID if we have metadata
      // For now, we'll use a simple mapping or default speaker
      const vctkSpeaker = speaker < 100 ? `VCTK_p${226 + speaker}` : "VCTK_p226";
      args.push("--speaker", vctkSpeaker);

      console.log(`[tts-synthesis] Running tts command: tts ${args.join(' ')}`);

      const { stdout, stderr } = await execFileAsync("tts", args);

      if (stderr) {
        console.warn(`[tts-synthesis] stderr: ${stderr}`);
      }

      // Read the generated file
      const fs = await import("fs");
      const audioBuffer = fs.readFileSync(outputPath);

      // Clean up temporary file
      fs.unlinkSync(outputPath);

      console.log(`[tts-synthesis] Generated ${audioBuffer.length} bytes of audio`);

      // Send audio as response with proper CORS headers
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', audioBuffer.length);
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001');
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.send(audioBuffer);

    } catch (error) {
      console.error("[tts-synthesis] Error:", error);
      res.status(500).json({ error: "TTS synthesis failed" });
    }
  });
}
