import { afterEach, describe, expect, it, spyOn } from "bun:test";

import { bwsFetcher } from "..";

/** Mock Bitwarden secret for testing. */
interface BwsSecret {
  /** The unique identifier of the secret. */
  id: string;
  /** The name/key used to look up the secret. */
  key: string;
  /** The secret's plaintext value. */
  value: string;
}

/**
 * Helper to mock Bun.spawn for bws CLI calls.
 * Handles both version check and secret list commands.
 * @param options
 * @returns mocked bws
 */
const mockBws = (options: {
  installed?: boolean;
  secrets?: BwsSecret[];
}): ReturnType<typeof spyOn> => {
  const { installed = true, secrets = [] } = options;

  return spyOn(Bun, "spawn").mockImplementation((cmdOrOptions: unknown) => {
    const cmd = Array.isArray(cmdOrOptions)
      ? cmdOrOptions
      : (cmdOrOptions as { cmd: string[] }).cmd;
    const isVersionCheck = cmd.includes("--version");

    if (isVersionCheck) {
      return {
        exited: Promise.resolve(installed ? 0 : 1),
        exitCode: installed ? 0 : 1,
        stdout: new Response(installed ? "1.0.0" : "").body,
        stderr: new Response("").body,
      } as unknown as ReturnType<typeof Bun.spawn>;
    }

    return {
      exited: Promise.resolve(0),
      exitCode: 0,
      stdout: new Response(JSON.stringify(secrets)).body,
      stderr: new Response("").body,
    } as unknown as ReturnType<typeof Bun.spawn>;
  });
};

describe("bwsFetcher", () => {
  let spawnSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    spawnSpy?.mockRestore();
  });

  it("should fetch secret by key", async () => {
    spawnSpy = mockBws({
      secrets: [
        { id: "1", key: "API_KEY", value: "secret-123" },
        { id: "2", key: "OTHER_KEY", value: "other-value" },
      ],
    });

    const result = await bwsFetcher.fetch("API_KEY");
    expect(result).toBe("secret-123");
  });

  it("should return undefined for non-existent key", async () => {
    spawnSpy = mockBws({
      secrets: [{ id: "1", key: "OTHER_KEY", value: "other-value" }],
    });

    const result = await bwsFetcher.fetch("NON_EXISTENT");
    expect(result).toBeUndefined();
  });

  it("should throw error if bws is not installed", async () => {
    spawnSpy = mockBws({ installed: false });

    try {
      await bwsFetcher.fetch("API_KEY");
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect((error as Error).message).toContain("bws CLI is not installed");
    }
  });
});
