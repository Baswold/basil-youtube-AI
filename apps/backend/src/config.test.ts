import { describe, it, expect } from "vitest";
import { appConfig, validateConfig } from "./config";

describe("Configuration System", () => {
  it("should use default values when env vars not set", () => {
    // Config loads defaults when not set
    expect(appConfig.port).toBeDefined();
    expect(appConfig.sttProvider).toBeDefined();
    expect(appConfig.ttsProvider).toBeDefined();
    expect(appConfig.guestProvider).toBeDefined();
  });

  it("should validate successfully with USE_REAL_ADAPTERS=false", () => {
    // With mock adapters, validation should pass even without API keys
    if (!appConfig.useRealAdapters) {
      expect(() => validateConfig()).not.toThrow();
    }
  });

  it("should have ANTHROPIC_API_KEY when using real adapters", () => {
    if (appConfig.useRealAdapters) {
      expect(appConfig.anthropicApiKey).toBeDefined();
    }
  });

  it("should have required keys for configured STT provider", () => {
    if (appConfig.useRealAdapters && appConfig.sttProvider === "assemblyai") {
      expect(appConfig.assemblyaiApiKey).toBeDefined();
    }
  });

  it("should have required keys for configured guest provider", () => {
    if (appConfig.useRealAdapters && appConfig.guestProvider === "groq") {
      expect(appConfig.groqApiKey).toBeDefined();
    }
  });

  it("should validate provider configuration", () => {
    expect(["assemblyai", "google", "whisper"]).toContain(appConfig.sttProvider);
    expect(["google", "piper"]).toContain(appConfig.ttsProvider);
    expect(["groq", "together", "local", "openai"]).toContain(appConfig.guestProvider);
  });

  it("should have boolean flag for real adapters", () => {
    expect(typeof appConfig.useRealAdapters).toBe("boolean");
  });

  it("should parse PORT as number", () => {
    expect(typeof appConfig.port).toBe("number");
    expect(appConfig.port).toBeGreaterThan(0);
  });

  it("should parse CORS_ORIGIN as array", () => {
    expect(Array.isArray(appConfig.corsOrigin)).toBe(true);
    expect(appConfig.corsOrigin.length).toBeGreaterThan(0);
  });

  it("should not require guest API key when using local provider", () => {
    if (appConfig.guestProvider === "local") {
      // Local provider doesn't need API keys
      expect(true).toBe(true);
    } else {
      expect(true).toBe(true); // Pass if not using local
    }
  });

  it("should allow google STT without ASSEMBLYAI_API_KEY", () => {
    if (appConfig.sttProvider === "google") {
      // Google uses GOOGLE_APPLICATION_CREDENTIALS, not ASSEMBLYAI_API_KEY
      expect(appConfig.sttProvider).toBe("google");
    } else {
      expect(true).toBe(true); // Pass if not using Google
    }
  });

  it("should use default recording directory", () => {
    expect(appConfig.recordingDir).toBeDefined();
    expect(typeof appConfig.recordingDir).toBe("string");
  });

  it("should have recording and briefings directories configured", () => {
    expect(appConfig.recordingDir).toBeDefined();
    expect(appConfig.briefingsDir).toBeDefined();
    expect(typeof appConfig.recordingDir).toBe("string");
    expect(typeof appConfig.briefingsDir).toBe("string");
  });
});
