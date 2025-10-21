import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { RecorderService } from "./recorder";
import path from "node:path";

describe("RecorderService", () => {
  const testOutputDir = "./test-recordings";
  const testEpisodeId = "test-recording-456";
  let recorder: RecorderService;

  beforeEach(async () => {
    recorder = new RecorderService({
      episodeId: testEpisodeId,
      outputDir: testOutputDir,
    });
    await recorder.start();
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.rm(path.join(testOutputDir, testEpisodeId), { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it("should create episode directory on start", async () => {
    const dirPath = path.join(testOutputDir, testEpisodeId);
    const stats = await fs.stat(dirPath);
    expect(stats.isDirectory()).toBe(true);
  });

  it("should write audio chunks for each speaker", async () => {
    const audioChunk = Buffer.from("fake audio data");
    
    await recorder.writeAudioChunk("you", audioChunk);
    await recorder.writeAudioChunk("claude", audioChunk);
    await recorder.writeAudioChunk("guest", audioChunk);
    
    const files = await recorder.stop();
    
    expect(files).toContain("you.webm");
    expect(files).toContain("claude.webm");
    expect(files).toContain("guest.webm");
  });

  it("should create VTT caption files", async () => {
    recorder.addCaption("you", "Hello world", Date.now());
    recorder.addCaption("claude", "Hi there", Date.now() + 1000);
    
    const files = await recorder.stop();
    
    expect(files).toContain("you.vtt");
    expect(files).toContain("claude.vtt");
  });

  it("should generate valid VTT format", async () => {
    const now = Date.now();
    recorder.addCaption("you", "First caption", now);
    recorder.addCaption("you", "Second caption", now + 3000);
    
    await recorder.stop();

    const vttPath = path.join(testOutputDir, testEpisodeId, "you.vtt");
    const content = await fs.readFile(vttPath, "utf-8");
    
    expect(content).toContain("WEBVTT");
    expect(content).toContain("First caption");
    expect(content).toContain("Second caption");
    expect(content).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/);
  });

  it("should create session metadata file", async () => {
    const files = await recorder.stop();
    
    expect(files).toContain("session.yml");
    
    const ymlPath = path.join(testOutputDir, testEpisodeId, "session.yml");
    const content = await fs.readFile(ymlPath, "utf-8");
    
    expect(content).toContain("episodeId:");
    expect(content).toContain(testEpisodeId);
    expect(content).toContain("recordingStartTime:");
    expect(content).toContain("recordingEndTime:");
  });

  it("should include model information in session metadata", async () => {
    await recorder.stop();
    
    const ymlPath = path.join(testOutputDir, testEpisodeId, "session.yml");
    const content = await fs.readFile(ymlPath, "utf-8");
    
    expect(content).toContain("models:");
    expect(content).toContain("claude:");
    expect(content).toContain("guest:");
  });

  it("should return correct output directory", () => {
    const outputDir = recorder.getOutputDirectory();
    expect(outputDir).toBe(path.join(testOutputDir, testEpisodeId));
  });

  it("should handle multiple captions in sequence", async () => {
    const baseTime = Date.now();
    
    recorder.addCaption("claude", "Caption 1", baseTime);
    recorder.addCaption("claude", "Caption 2", baseTime + 2000);
    recorder.addCaption("claude", "Caption 3", baseTime + 4000);
    
    await recorder.stop();

    const vttPath = path.join(testOutputDir, testEpisodeId, "claude.vtt");
    const content = await fs.readFile(vttPath, "utf-8");
    const lines = content.split("\n");
    
    // Should have 3 caption entries
    const captionCount = content.split("Caption").length - 1;
    expect(captionCount).toBe(3);
  });

  it("should create separate files for each speaker", async () => {
    recorder.addCaption("you", "Speaker 1");
    recorder.addCaption("claude", "Speaker 2");
    recorder.addCaption("guest", "Speaker 3");
    
    await recorder.stop();

    const dirPath = path.join(testOutputDir, testEpisodeId);
    const files = await fs.readdir(dirPath);
    
    expect(files).toContain("you.vtt");
    expect(files).toContain("claude.vtt");
    expect(files).toContain("guest.vtt");
  });

  it("should format timestamps correctly", async () => {
    const now = Date.now();
    recorder.addCaption("you", "Test", now);
    
    await recorder.stop();

    const vttPath = path.join(testOutputDir, testEpisodeId, "you.vtt");
    const content = await fs.readFile(vttPath, "utf-8");
    
    // VTT format: HH:MM:SS.mmm --> HH:MM:SS.mmm
    const timestampRegex = /\d{2}:\d{2}:\d{2}\.\d{3}/;
    expect(content).toMatch(timestampRegex);
  });

  it("should handle captions with default timestamps", () => {
    // Should not throw when timestamp is omitted
    expect(() => {
      recorder.addCaption("you", "No timestamp provided");
    }).not.toThrow();
  });

  it("should write audio chunks without errors", async () => {
    const chunk1 = Buffer.from("audio chunk 1");
    const chunk2 = Buffer.from("audio chunk 2");
    
    await expect(recorder.writeAudioChunk("you", chunk1)).resolves.not.toThrow();
    await expect(recorder.writeAudioChunk("you", chunk2)).resolves.not.toThrow();
  });

  it("should close all streams properly on stop", async () => {
    await recorder.writeAudioChunk("you", Buffer.from("data"));
    await recorder.writeAudioChunk("claude", Buffer.from("data"));
    
    // Should not throw
    await expect(recorder.stop()).resolves.toBeDefined();
  });
});
