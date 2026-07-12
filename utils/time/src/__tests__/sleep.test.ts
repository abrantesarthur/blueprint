import { describe, expect, test } from "bun:test";

import { sleep } from "../sleep";

describe("utils/time/sleep.ts", () => {
  describe("sleep", () => {
    test("resolves after at least the requested duration", async () => {
      const start = performance.now();
      await sleep(50);
      const elapsed = performance.now() - start;
      // Allow a small scheduler slop on the low end; the upper bound is
      // generous to avoid flakes on a loaded CI runner.
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(500);
    });

    test("resolves on the next tick for non-positive durations", async () => {
      const start = performance.now();
      await sleep(0);
      expect(performance.now() - start).toBeLessThan(50);
    });
  });
});
