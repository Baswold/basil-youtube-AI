import { describe, it, expect } from "vitest";
import { MockAdapterFactory } from "./mock";

describe("MockAdapterFactory", () => {
  const factory = new MockAdapterFactory();

  describe("STT Adapter", () => {
    it("should create STT adapter", () => {
      const stt = factory.stt();
      expect(stt).toBeDefined();
      expect(stt.start).toBeInstanceOf(Function);
      expect(stt.stop).toBeInstanceOf(Function);
    });

    it("should start STT session without error", async () => {
      const stt = factory.stt();
      await expect(stt.start("session-1")).resolves.not.toThrow();
    });

    it("should stop STT session without error", async () => {
      const stt = factory.stt();
      await stt.start("session-1");
      await expect(stt.stop("session-1")).resolves.not.toThrow();
    });
  });

  describe("TTS Adapter", () => {
    it("should create TTS adapter", () => {
      const tts = factory.tts();
      expect(tts).toBeDefined();
      expect(tts.synthesize).toBeInstanceOf(Function);
      expect(tts.stop).toBeInstanceOf(Function);
    });

    it("should synthesize text without error", async () => {
      const tts = factory.tts();
      await expect(tts.synthesize("session-1", "Hello world")).resolves.not.toThrow();
    });

    it("should stop TTS session without error", async () => {
      const tts = factory.tts();
      await expect(tts.stop("session-1")).resolves.not.toThrow();
    });
  });

  describe("LLM Adapter", () => {
    it("should create Claude LLM adapter", () => {
      const llm = factory.llm("claude");
      expect(llm).toBeDefined();
      expect(llm.id).toBe("claude");
      expect(llm.generate).toBeInstanceOf(Function);
      expect(llm.stop).toBeInstanceOf(Function);
    });

    it("should create guest LLM adapter", () => {
      const llm = factory.llm("guest");
      expect(llm).toBeDefined();
      expect(llm.id).toBe("guest");
    });

    it("should generate mock response", async () => {
      const llm = factory.llm("claude");
      const generator = llm.generate("session-1", "Test prompt");
      
      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }
      
      expect(results).toHaveLength(1);
      expect(results[0]).toContain("mock-response(claude)");
      expect(results[0]).toContain("Test prompt");
    });

    it("should stop LLM generation without error", async () => {
      const llm = factory.llm("claude");
      await expect(llm.stop("session-1")).resolves.not.toThrow();
    });

    it("should have different IDs for different adapters", () => {
      const claude = factory.llm("claude");
      const guest = factory.llm("guest");
      
      expect(claude.id).not.toBe(guest.id);
    });
  });
});
