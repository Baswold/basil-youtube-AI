import { describe, it, expect } from "vitest";
import { CommandRouter } from "./command-router";

describe("CommandRouter", () => {
  const router = new CommandRouter();

  it("should detect direct address to Claude", () => {
    const result = router.route("Claude, give me the summary");
    expect(result).toBeTruthy();
    expect(result?.targets).toEqual(["claude"]);
    expect(result?.action).toBe("address");
  });

  it("should detect thinking mode request with duration", () => {
    const result = router.route("Claude, enter thinking mode for 45 seconds");
    expect(result).toBeTruthy();
    expect(result?.action).toBe("thinking");
    expect(result?.durationMs).toBe(45_000);
  });

  it("should default thinking mode to Claude when no explicit address", () => {
    const result = router.route("We need thinking mode for a minute");
    expect(result).toBeTruthy();
    expect(result?.targets).toEqual(["claude"]);
    expect(result?.action).toBe("thinking");
  });

  it("should address both agents when keyword is everyone", () => {
    const result = router.route("Everyone, let's start the cross-exam");
    expect(result).toBeTruthy();
    expect(result?.targets).toEqual(["claude", "guest"]);
  });
});
