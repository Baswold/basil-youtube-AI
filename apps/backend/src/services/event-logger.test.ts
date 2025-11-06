import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { EventLogger } from "./event-logger";
import path from "node:path";

describe("EventLogger", () => {
  const testOutputDir = "./test-recordings";
  const testEpisodeId = "test-episode-123";
  let logger: EventLogger;

  beforeEach(async () => {
    logger = new EventLogger({
      episodeId: testEpisodeId,
      outputDir: testOutputDir,
    });
    await logger.start();
  });

  afterEach(async () => {
    await logger.stop();
    // Cleanup test files
    try {
      await fs.rm(path.join(testOutputDir, testEpisodeId), { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it("should create output directory", async () => {
    const dirPath = path.join(testOutputDir, testEpisodeId);
    const stats = await fs.stat(dirPath);
    expect(stats.isDirectory()).toBe(true);
  });

  it("should log session start event", async () => {
    logger.logSessionStart("session-1", testEpisodeId, { test: true });
    await logger.stop();

    const filePath = path.join(testOutputDir, testEpisodeId, "events.jsonl");
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");
    
    expect(lines.length).toBeGreaterThan(0);
    const event = JSON.parse(lines[0]);
    expect(event.type).toBe("session.start");
    expect(event.sessionId).toBe("session-1");
    expect(event.episodeId).toBe(testEpisodeId);
  });

  it("should log multiple events in sequence", async () => {
    const sessionId = "session-1";
    
    logger.logSessionStart(sessionId, testEpisodeId, {});
    logger.logVadSpeechStart(sessionId, "you", 0.95);
    logger.logSttTranscript(sessionId, "you", "Hello world", true, 0.98);
    logger.logVadSpeechEnd(sessionId, "you");
    
    await logger.stop();

    const filePath = path.join(testOutputDir, testEpisodeId, "events.jsonl");
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");
    
    expect(lines.length).toBe(4);
    
    const events = lines.map(line => JSON.parse(line));
    expect(events[0].type).toBe("session.start");
    expect(events[1].type).toBe("vad.speech-start");
    expect(events[2].type).toBe("stt.final");
    expect(events[3].type).toBe("vad.speech-end");
  });

  it("should include timestamps on all events", async () => {
    logger.logSessionStart("session-1", testEpisodeId, {});
    logger.logSttTranscript("session-1", "you", "Test", true);
    
    await logger.stop();

    const filePath = path.join(testOutputDir, testEpisodeId, "events.jsonl");
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");
    
    const events = lines.map(line => JSON.parse(line));
    events.forEach(event => {
      expect(event).toHaveProperty("timestamp");
      expect(typeof event.timestamp).toBe("number");
      expect(event.timestamp).toBeGreaterThan(0);
    });
  });

  it("should log LLM events", async () => {
    const sessionId = "session-1";
    
    logger.logLlmStart(sessionId, "claude", "claude-3-5-haiku");
    logger.logLlmChunk(sessionId, "claude", "Hello");
    logger.logLlmComplete(sessionId, "claude", 150);
    
    await logger.stop();

    const filePath = path.join(testOutputDir, testEpisodeId, "events.jsonl");
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");
    
    expect(lines.length).toBe(3);
    
    const events = lines.map(line => JSON.parse(line));
    expect(events[0].type).toBe("llm.start");
    expect(events[0].model).toBe("claude-3-5-haiku");
    expect(events[1].type).toBe("llm.chunk");
    expect(events[1].text).toBe("Hello");
    expect(events[2].type).toBe("llm.complete");
    expect(events[2].latency).toBe(150);
  });

  it("should log TTS events", async () => {
    const sessionId = "session-1";
    
    logger.logTtsStart(sessionId, "claude", "Hello");
    logger.logTtsChunk(sessionId, "claude", 2048);
    logger.logTtsComplete(sessionId, "claude");
    
    await logger.stop();

    const filePath = path.join(testOutputDir, testEpisodeId, "events.jsonl");
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");
    
    const events = lines.map(line => JSON.parse(line));
    expect(events[0].type).toBe("tts.start");
    expect(events[0].text).toBe("Hello");
    expect(events[1].type).toBe("tts.chunk");
    expect(events[1].audioSize).toBe(2048);
    expect(events[2].type).toBe("tts.complete");
  });

  it("should log orb state changes", async () => {
    logger.logOrbStateChange("session-1", "claude", "idle", "speaking");
    
    await logger.stop();

    const filePath = path.join(testOutputDir, testEpisodeId, "events.jsonl");
    const content = await fs.readFile(filePath, "utf-8");
    const event = JSON.parse(content.trim());
    
    expect(event.type).toBe("orb.state-change");
    expect(event.speaker).toBe("claude");
    expect(event.oldState).toBe("idle");
    expect(event.newState).toBe("speaking");
  });

  it("should log thinking mode events", async () => {
    logger.logThinkingMode("session-1", "claude", 30000);
    
    await logger.stop();

    const filePath = path.join(testOutputDir, testEpisodeId, "events.jsonl");
    const content = await fs.readFile(filePath, "utf-8");
    const event = JSON.parse(content.trim());
    
    expect(event.type).toBe("mode.thinking");
    expect(event.speaker).toBe("claude");
    expect(event.duration).toBe(30000);
  });

  it("should log autopilot toggle events", async () => {
    logger.logAutopilot("session-1", true);
    logger.logAutopilot("session-1", false);
    
    await logger.stop();

    const filePath = path.join(testOutputDir, testEpisodeId, "events.jsonl");
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");
    
    const events = lines.map(line => JSON.parse(line));
    expect(events[0].enabled).toBe(true);
    expect(events[1].enabled).toBe(false);
  });

  it("should log barge-in events", async () => {
    logger.logBargeIn("session-1", "you", ["claude", "guest"]);
    
    await logger.stop();

    const filePath = path.join(testOutputDir, testEpisodeId, "events.jsonl");
    const content = await fs.readFile(filePath, "utf-8");
    const event = JSON.parse(content.trim());
    
    expect(event.type).toBe("barge-in");
    expect(event.interrupter).toBe("you");
    expect(event.interrupted).toEqual(["claude", "guest"]);
  });

  it("should log command routing events", async () => {
    logger.logCommandRoute("session-1", {
      raw: "Claude, take thinking mode",
      normalized: "claude, take thinking mode",
      targets: ["claude"],
      remainder: "take thinking mode",
      action: "thinking",
      confidence: 0.8,
      durationMs: 30000,
    });

    await logger.stop();

    const filePath = path.join(testOutputDir, testEpisodeId, "events.jsonl");
    const content = await fs.readFile(filePath, "utf-8");
    const event = JSON.parse(content.trim());

    expect(event.type).toBe("command.route");
    expect(event.targets).toEqual(["claude"]);
    expect(event.durationMs).toBe(30000);
  });

  it("should log error events with stack traces", async () => {
    const error = new Error("Test error");
    logger.logError("session-1", error, { service: "stt" });
    
    await logger.stop();

    const filePath = path.join(testOutputDir, testEpisodeId, "events.jsonl");
    const content = await fs.readFile(filePath, "utf-8");
    const event = JSON.parse(content.trim());
    
    expect(event.type).toBe("error");
    expect(event.error).toBe("Test error");
    expect(event.stack).toBeDefined();
    expect(event.context).toEqual({ service: "stt" });
  });

  it("should handle file write errors gracefully", async () => {
    // This test ensures the logger doesn't crash on write errors
    const invalidLogger = new EventLogger({
      episodeId: "/invalid/path/episode",
      outputDir: "/invalid/path",
    });

    // Should not throw
    expect(async () => {
      await invalidLogger.start();
    }).rejects.toThrow();
  });
});
