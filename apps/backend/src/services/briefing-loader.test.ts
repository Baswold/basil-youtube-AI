import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { BriefingLoader } from "./briefing-loader";
import path from "node:path";

describe("BriefingLoader", () => {
  const testBriefingsDir = "./test-briefings";
  let loader: BriefingLoader;

  beforeEach(async () => {
    await fs.mkdir(testBriefingsDir, { recursive: true });
    loader = new BriefingLoader(testBriefingsDir);
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.rm(testBriefingsDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it("should load briefing with frontmatter", async () => {
    const briefingContent = `---
title: Test Episode
topic: Testing
tone: professional
mustCover: [point1, point2]
targetDuration: 1200
---

# Episode Briefing

This is the episode content.`;

    const filePath = path.join(testBriefingsDir, "test.md");
    await fs.writeFile(filePath, briefingContent);

    const briefing = await loader.load("test.md");
    
    expect(briefing.metadata.title).toBe("Test Episode");
    expect(briefing.metadata.topic).toBe("Testing");
    expect(briefing.metadata.tone).toBe("professional");
    expect(briefing.metadata.targetDuration).toBe(1200);
    expect(briefing.content).toContain("This is the episode content");
  });

  it("should parse mustCover array", async () => {
    const briefingContent = `---
mustCover: [item1, item2, item3]
---

Content`;

    const filePath = path.join(testBriefingsDir, "array-test.md");
    await fs.writeFile(filePath, briefingContent);

    const briefing = await loader.load("array-test.md");
    
    expect(briefing.metadata.mustCover).toEqual(["item1", "item2", "item3"]);
  });

  it("should generate Claude system prompt", async () => {
    const briefingContent = `---
title: Test
topic: AI Discussion
tone: engaging
mustCover: [privacy, efficiency]
---

Discuss AI topics.`;

    const filePath = path.join(testBriefingsDir, "prompt-test.md");
    await fs.writeFile(filePath, briefingContent);

    const briefing = await loader.load("prompt-test.md");
    
    expect(briefing.systemPromptClaude).toContain("Claude");
    expect(briefing.systemPromptClaude).toContain("co-host");
    expect(briefing.systemPromptClaude).toContain("AI Discussion");
    expect(briefing.systemPromptClaude).toContain("privacy");
    expect(briefing.systemPromptClaude).toContain("efficiency");
  });

  it("should generate guest system prompt", async () => {
    const briefingContent = `---
title: Test
topic: Technology
---

Tech discussion.`;

    const filePath = path.join(testBriefingsDir, "guest-test.md");
    await fs.writeFile(filePath, briefingContent);

    const briefing = await loader.load("guest-test.md");
    
    expect(briefing.systemPromptGuest).toContain("guest AI");
    expect(briefing.systemPromptGuest).toContain("Technology");
    expect(briefing.systemPromptGuest).toContain("Tech discussion");
  });

  it("should handle briefing without frontmatter", async () => {
    const briefingContent = "# Just content without frontmatter\n\nSome text.";

    const filePath = path.join(testBriefingsDir, "no-frontmatter.md");
    await fs.writeFile(filePath, briefingContent);

    const briefing = await loader.load("no-frontmatter.md");
    
    expect(briefing.metadata).toEqual({});
    expect(briefing.content).toBe(briefingContent);
  });

  it("should handle empty mustCover list", async () => {
    const briefingContent = `---
title: Test
---

Content`;

    const filePath = path.join(testBriefingsDir, "empty-array.md");
    await fs.writeFile(filePath, briefingContent);

    const briefing = await loader.load("empty-array.md");
    
    expect(briefing.metadata.mustCover).toBeUndefined();
  });

  it("should list all briefing files", async () => {
    await fs.writeFile(path.join(testBriefingsDir, "brief1.md"), "Content");
    await fs.writeFile(path.join(testBriefingsDir, "brief2.md"), "Content");
    await fs.writeFile(path.join(testBriefingsDir, "brief3.txt"), "Content");
    await fs.writeFile(path.join(testBriefingsDir, "not-brief.json"), "{}");

    const files = await loader.list();
    
    expect(files).toContain("brief1.md");
    expect(files).toContain("brief2.md");
    expect(files).toContain("brief3.txt");
    expect(files).not.toContain("not-brief.json");
  });

  it("should throw error for non-existent file", async () => {
    await expect(loader.load("non-existent.md")).rejects.toThrow();
  });

  it("should handle absolute paths", async () => {
    const briefingContent = "# Test";
    const absolutePath = path.join(process.cwd(), testBriefingsDir, "absolute.md");
    await fs.writeFile(absolutePath, briefingContent);

    const briefing = await loader.load(absolutePath);
    
    expect(briefing.content).toContain("Test");
  });

  it("should parse avoidTopics array", async () => {
    const briefingContent = `---
avoidTopics: [politics, religion]
---

Content`;

    const filePath = path.join(testBriefingsDir, "avoid-test.md");
    await fs.writeFile(filePath, briefingContent);

    const briefing = await loader.load("avoid-test.md");
    
    expect(briefing.metadata.avoidTopics).toEqual(["politics", "religion"]);
  });

  it("should include guidelines in Claude prompt", async () => {
    const briefingContent = `---
title: Test
---

Test content`;

    const filePath = path.join(testBriefingsDir, "guidelines.md");
    await fs.writeFile(filePath, briefingContent);

    const briefing = await loader.load("guidelines.md");
    
    expect(briefing.systemPromptClaude).toContain("Guidelines:");
    expect(briefing.systemPromptClaude).toContain("Listen actively");
    expect(briefing.systemPromptClaude).toContain("interrupt naturally");
  });

  it("should include avoid topics in prompt", async () => {
    const briefingContent = `---
avoidTopics: [controversial topic]
---

Content`;

    const filePath = path.join(testBriefingsDir, "avoid-prompt.md");
    await fs.writeFile(filePath, briefingContent);

    const briefing = await loader.load("avoid-prompt.md");
    
    expect(briefing.systemPromptClaude).toContain("Avoid:");
    expect(briefing.systemPromptClaude).toContain("controversial topic");
  });

  it("should handle tone in prompt generation", async () => {
    const briefingContent = `---
tone: casual and fun
---

Content`;

    const filePath = path.join(testBriefingsDir, "tone-test.md");
    await fs.writeFile(filePath, briefingContent);

    const briefing = await loader.load("tone-test.md");
    
    expect(briefing.systemPromptClaude).toContain("Tone:");
    expect(briefing.systemPromptClaude).toContain("casual and fun");
    expect(briefing.systemPromptGuest).toContain("Expected Tone:");
    expect(briefing.systemPromptGuest).toContain("casual and fun");
  });

  it("should return empty array if briefings directory doesn't exist", async () => {
    const nonExistentLoader = new BriefingLoader("./non-existent-dir");
    const files = await nonExistentLoader.list();
    
    expect(files).toEqual([]);
  });
});
