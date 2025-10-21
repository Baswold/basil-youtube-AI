import { createWriteStream, promises as fs } from "node:fs";
import { join } from "node:path";
import type { SpeakerId } from "@basil/shared";

interface RecorderConfig {
  outputDir?: string;
  episodeId: string;
}

interface VttEntry {
  startTime: number;
  endTime: number;
  text: string;
}

export class RecorderService {
  private config: RecorderConfig;
  private outputDir: string;
  private audioStreams = new Map<SpeakerId, any>();
  private vttEntries = new Map<SpeakerId, VttEntry[]>();
  private recordingStartTime: number = 0;

  constructor(config: RecorderConfig) {
    this.config = {
      outputDir: "./recordings",
      ...config,
    };
    this.outputDir = join(this.config.outputDir!, this.config.episodeId);
  }

  async start(): Promise<void> {
    // Create output directory
    await fs.mkdir(this.outputDir, { recursive: true });
    
    this.recordingStartTime = Date.now();
    
    // Initialize VTT arrays for each speaker
    const speakers: SpeakerId[] = ["you", "claude", "guest"];
    for (const speaker of speakers) {
      this.vttEntries.set(speaker, []);
    }

    console.info(`[recorder] started for episode ${this.config.episodeId}`);
  }

  async writeAudioChunk(speaker: SpeakerId, chunk: Buffer): Promise<void> {
    let stream = this.audioStreams.get(speaker);
    
    if (!stream) {
      const filename = join(this.outputDir, `${speaker}.webm`);
      stream = createWriteStream(filename);
      this.audioStreams.set(speaker, stream);
      console.info(`[recorder] opened audio stream for ${speaker}`);
    }

    stream.write(chunk);
  }

  addCaption(speaker: SpeakerId, text: string, timestamp?: number): void {
    const entries = this.vttEntries.get(speaker);
    if (!entries) return;

    const now = timestamp || Date.now();
    const relativeTime = now - this.recordingStartTime;
    
    // Add entry with estimated duration (will be updated on next caption)
    const entry: VttEntry = {
      startTime: relativeTime,
      endTime: relativeTime + 3000, // Default 3s duration
      text,
    };

    // Update previous entry's end time
    if (entries.length > 0) {
      entries[entries.length - 1].endTime = relativeTime;
    }

    entries.push(entry);
  }

  async stop(): Promise<string[]> {
    const files: string[] = [];

    // Close all audio streams
    for (const [speaker, stream] of this.audioStreams) {
      await new Promise<void>((resolve) => {
        stream.end(() => {
          console.info(`[recorder] closed audio stream for ${speaker}`);
          resolve();
        });
      });
      files.push(`${speaker}.webm`);
    }

    // Write VTT caption files
    for (const [speaker, entries] of this.vttEntries) {
      const vttContent = this.generateVtt(entries);
      const vttPath = join(this.outputDir, `${speaker}.vtt`);
      await fs.writeFile(vttPath, vttContent, "utf-8");
      files.push(`${speaker}.vtt`);
      console.info(`[recorder] wrote VTT for ${speaker}`);
    }

    // Write session metadata
    await this.writeSessionMetadata();
    files.push("session.yml");

    console.info(`[recorder] stopped, files: ${files.join(", ")}`);
    return files;
  }

  private generateVtt(entries: VttEntry[]): string {
    let vtt = "WEBVTT\n\n";
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      vtt += `${i + 1}\n`;
      vtt += `${this.formatTime(entry.startTime)} --> ${this.formatTime(entry.endTime)}\n`;
      vtt += `${entry.text}\n\n`;
    }

    return vtt;
  }

  private formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  }

  private async writeSessionMetadata(): Promise<void> {
    const metadata = {
      episodeId: this.config.episodeId,
      recordingStartTime: new Date(this.recordingStartTime).toISOString(),
      recordingEndTime: new Date().toISOString(),
      duration: Date.now() - this.recordingStartTime,
      models: {
        claude: process.env.CLAUDE_MODEL || "claude-3-5-haiku-20241022",
        guest: process.env.GUEST_MODEL || "unknown",
        stt: process.env.STT_PROVIDER || "mock",
        tts: process.env.TTS_PROVIDER || "mock",
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
      },
    };

    const yamlContent = this.objectToYaml(metadata);
    const yamlPath = join(this.outputDir, "session.yml");
    await fs.writeFile(yamlPath, yamlContent, "utf-8");
  }

  private objectToYaml(obj: any, indent = 0): string {
    let yaml = "";
    const spaces = "  ".repeat(indent);

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        yaml += `${spaces}${key}: null\n`;
      } else if (typeof value === "object" && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += this.objectToYaml(value, indent + 1);
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          yaml += `${spaces}  - ${item}\n`;
        }
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }

    return yaml;
  }

  getOutputDirectory(): string {
    return this.outputDir;
  }
}
