import { describe, expect, it } from "bun:test";

import { setupEnvCleanup } from "../../argTypes/__tests__/utils";
import { envFetcher } from "..";

describe("envFetcher", () => {
  setupEnvCleanup();

  it("should fetch existing environment variable", async () => {
    Bun.env["TEST_VAR"] = "test-value";
    const result = await envFetcher.fetch("TEST_VAR");
    expect(result).toBe("test-value");
  });

  it("should return undefined for non-existent variable", async () => {
    const result = await envFetcher.fetch("NON_EXISTENT_VAR");
    expect(result).toBeUndefined();
  });
});
