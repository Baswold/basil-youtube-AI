import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ProductionOrchestrator } from "./orchestrator-v2";
import { promises as fs } from "node:fs";

describe("ProductionOrchestrator (Integration)", () => {
  let orchestrator: ProductionOrchestrator;
  const testRecordingDir = "./test-recordings-integration";

  beforeEach(() => {
    // Create orchestrator
    orchestrator = new ProductionOrchestrator({
      useRealAdapters: false,
      episodeId: "test-integration",
      recordingDir: testRecordingDir,
    });
  });

  afterEach(async () => {
    // Cleanup
    if (orchestrator) {
      await orchestrator.shutdown();
    }

    // Cleanup test files
    try {
      await fs.rm(testRecordingDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it("should register socket successfully", async () => {
    const mockSocket: any = {
      id: "test-socket-1",
      emit: vi.fn(),
      on: vi.fn(),
    };

    await expect(orchestrator.register(mockSocket)).resolves.not.toThrow();
    expect(mockSocket.emit).toHaveBeenCalled();
  });

  it("should emit initial state on connection", async () => {
    const mockSocket: any = {
      id: "test-socket-1",
      emit: vi.fn(),
      on: vi.fn(),
    };

    await orchestrator.register(mockSocket);

    // Check that initial state was emitted
    expect(mockSocket.emit).toHaveBeenCalledWith("server.ack", "connected");
    expect(mockSocket.emit).toHaveBeenCalledWith("state.snapshot", expect.objectContaining({
      orbStates: expect.any(Object),
      captions: expect.any(Array),
      autopilot: expect.any(Boolean),
    }));
  });

  it("should setup event handlers on socket", async () => {
    const mockSocket: any = {
      id: "test-socket-1",
      emit: vi.fn(),
      on: vi.fn(),
    };

    await orchestrator.register(mockSocket);

    // Verify event handlers were registered
    const registeredEvents = mockSocket.on.mock.calls.map((call: any) => call[0]);
    expect(registeredEvents).toContain("hello");
    expect(registeredEvents).toContain("client.toggle-autopilot");
    expect(registeredEvents).toContain("disconnect");
  });

  it("should cleanup session on disconnect", async () => {
    const mockSocket: any = {
      id: "test-disconnect",
      emit: vi.fn(),
      on: vi.fn(),
    };

    await orchestrator.register(mockSocket);
    
    // Simulate disconnect
    const disconnectHandler = mockSocket.on.mock.calls.find(
      (call: any) => call[0] === "disconnect"
    );
    
    if (disconnectHandler) {
      await expect(disconnectHandler[1]()).resolves.not.toThrow();
    }
  });

  it("should handle multiple sessions concurrently", async () => {
    const socket1: any = {
      id: "session-1",
      emit: vi.fn(),
      on: vi.fn(),
    };

    const socket2: any = {
      id: "session-2",
      emit: vi.fn(),
      on: vi.fn(),
    };

    await Promise.all([
      orchestrator.register(socket1),
      orchestrator.register(socket2),
    ]);

    // Both sessions should be registered
    expect(socket1.emit).toHaveBeenCalled();
    expect(socket2.emit).toHaveBeenCalled();
  });

  it("should shutdown gracefully", async () => {
    const mockSocket: any = {
      id: "test-shutdown",
      emit: vi.fn(),
      on: vi.fn(),
    };

    await orchestrator.register(mockSocket);
    
    await expect(orchestrator.shutdown()).resolves.not.toThrow();
  });
});
