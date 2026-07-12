import { ONE_DAY, ONE_MINUTE } from "@blueprint/time-utils";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { RateLimitStore } from "../store";

describe("shared/middleware/rateLimit/store.ts", () => {
  let store: RateLimitStore;

  beforeEach(() => {
    // Create a store with long cleanup interval for predictable testing
    store = RateLimitStore.createTestInstance(ONE_DAY, 100);
  });

  afterEach(() => {
    store.destroy();
  });

  describe("hit()", () => {
    test("allows first request for a new key", () => {
      const result = store.hit({
        key: "test-key",
        window: ONE_MINUTE,
        max: 10,
      });

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(9);
      expect(result.retryAfter).toBe(0);
    });

    test("counts requests correctly within the same window", () => {
      for (let i = 1; i <= 5; i++) {
        const result = store.hit({
          key: "test-key",
          window: ONE_MINUTE,
          max: 10,
        });
        expect(result.allowed).toBe(true);
        expect(result.current).toBe(i);
        expect(result.remaining).toBe(10 - i);
      }
    });

    test("blocks requests when limit is exceeded", () => {
      // Fill up the limit
      for (let i = 0; i < 10; i++) {
        store.hit({ key: "test-key", window: ONE_MINUTE, max: 10 });
      }

      // Next request should be blocked
      const result = store.hit({
        key: "test-key",
        window: ONE_MINUTE,
        max: 10,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test("does not increment count when request is blocked", () => {
      // Fill up the limit
      for (let i = 0; i < 10; i++) {
        store.hit({ key: "test-key", window: ONE_MINUTE, max: 10 });
      }

      // Try to hit again (should be blocked)
      const blocked1 = store.hit({
        key: "test-key",
        window: ONE_MINUTE,
        max: 10,
      });
      const blocked2 = store.hit({
        key: "test-key",
        window: ONE_MINUTE,
        max: 10,
      });

      // Current should remain at 10, not increment
      expect(blocked1.current).toBe(10);
      expect(blocked2.current).toBe(10);
    });

    test("tracks separate keys independently", () => {
      store.hit({ key: "key-a", window: ONE_MINUTE, max: 5 });
      store.hit({ key: "key-a", window: ONE_MINUTE, max: 5 });
      store.hit({ key: "key-b", window: ONE_MINUTE, max: 5 });

      const resultA = store.hit({ key: "key-a", window: ONE_MINUTE, max: 5 });
      const resultB = store.hit({ key: "key-b", window: ONE_MINUTE, max: 5 });

      expect(resultA.current).toBe(3);
      expect(resultB.current).toBe(2);
    });
  });

  describe("burst allowance", () => {
    test("allows requests up to burst limit with burstAllowance", () => {
      const window = ONE_MINUTE;
      const max = 10;
      const burstAllowance = 0.2; // 20% burst = 12 effective max

      // Should allow 12 requests (10 * 1.2)
      for (let i = 0; i < 12; i++) {
        const result = store.hit({
          key: "burst-key",
          window,
          max,
          burstAllowance,
        });
        expect(result.allowed).toBe(true);
      }

      // 13th request should be blocked
      const result = store.hit({
        key: "burst-key",
        window,
        max,
        burstAllowance,
      });
      expect(result.allowed).toBe(false);
    });

    test("reports correct limit without burst in result", () => {
      const result = store.hit({
        key: "burst-key",
        window: ONE_MINUTE,
        max: 10,
        burstAllowance: 0.2,
      });

      // Limit should be the configured max, not the burst max
      expect(result.limit).toBe(10);
    });

    test("no burst allowed when burstAllowance is 0", () => {
      const window = ONE_MINUTE;
      const max = 10;
      const burstAllowance = 0;

      for (let i = 0; i < 10; i++) {
        store.hit({ key: "no-burst-key", window, max, burstAllowance });
      }

      const result = store.hit({
        key: "no-burst-key",
        window,
        max,
        burstAllowance,
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe("sliding window counter", () => {
    test("transitions to new window and preserves previous count", async () => {
      const window = 100; // 100ms window for testing

      // Make 5 requests in first window
      for (let i = 0; i < 5; i++) {
        store.hit({ key: "sliding-key", window, max: 10 });
      }

      // Wait for window to pass
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 110);
      });

      // In the new window, weighted count should include previous window
      const result = store.hit({ key: "sliding-key", window, max: 10 });

      // Should be allowed (new window starts fresh, previous count is weighted down)
      expect(result.allowed).toBe(true);
      // Current should be 1 in the new window + weighted previous
      expect(result.current).toBeGreaterThanOrEqual(1);
    });

    test("resets completely when multiple windows pass", async () => {
      const window = 50; // 50ms window

      // Make requests
      for (let i = 0; i < 5; i++) {
        store.hit({ key: "multi-window-key", window, max: 10 });
      }

      // Wait for multiple windows to pass
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 150);
      });

      // Should reset completely
      const result = store.hit({ key: "multi-window-key", window, max: 10 });

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.remaining).toBe(9);
    });
  });

  describe("reset()", () => {
    test("removes the rate limit for a key", () => {
      // Add some hits
      store.hit({ key: "reset-key", window: ONE_MINUTE, max: 10 });
      store.hit({ key: "reset-key", window: ONE_MINUTE, max: 10 });
      store.hit({ key: "reset-key", window: ONE_MINUTE, max: 10 });

      // Reset the key
      store.reset("reset-key");

      // Should start fresh
      const result = store.hit({
        key: "reset-key",
        window: ONE_MINUTE,
        max: 10,
      });

      expect(result.current).toBe(1);
      expect(result.remaining).toBe(9);
    });

    test("does not affect other keys", () => {
      store.hit({ key: "key-1", window: ONE_MINUTE, max: 10 });
      store.hit({ key: "key-1", window: ONE_MINUTE, max: 10 });
      store.hit({ key: "key-2", window: ONE_MINUTE, max: 10 });

      store.reset("key-1");

      const result2 = store.hit({ key: "key-2", window: ONE_MINUTE, max: 10 });
      expect(result2.current).toBe(2);
    });
  });

  describe("size", () => {
    test("returns the number of tracked keys", () => {
      expect(store.size).toBe(0);

      store.hit({ key: "key-1", window: ONE_MINUTE, max: 10 });
      expect(store.size).toBe(1);

      store.hit({ key: "key-2", window: ONE_MINUTE, max: 10 });
      expect(store.size).toBe(2);

      store.hit({ key: "key-1", window: ONE_MINUTE, max: 10 }); // Same key, shouldn't increase size
      expect(store.size).toBe(2);
    });
  });

  describe("destroy()", () => {
    test("clears all entries", () => {
      store.hit({ key: "key-1", window: ONE_MINUTE, max: 10 });
      store.hit({ key: "key-2", window: ONE_MINUTE, max: 10 });

      expect(store.size).toBe(2);

      store.destroy();

      expect(store.size).toBe(0);
    });
  });

  describe("DDoS protection (max entries)", () => {
    test("evicts oldest entries when max entries reached", () => {
      // Create a store with small max entries for testing
      const smallStore = RateLimitStore.createTestInstance(ONE_DAY, 10);

      // Fill up the store
      for (let i = 0; i < 10; i++) {
        smallStore.hit({ key: `key-${i}`, window: ONE_MINUTE, max: 100 });
      }

      expect(smallStore.size).toBe(10);

      // Add one more - should trigger eviction
      smallStore.hit({ key: "key-new", window: ONE_MINUTE, max: 100 });

      // Size should be less than or equal to 10 (after eviction)
      expect(smallStore.size).toBeLessThanOrEqual(10);

      smallStore.destroy();
    });

    test("new key is added after eviction", () => {
      const smallStore = RateLimitStore.createTestInstance(ONE_DAY, 5);

      // Fill up
      for (let i = 0; i < 5; i++) {
        smallStore.hit({ key: `key-${i}`, window: ONE_MINUTE, max: 100 });
      }

      // Add new key
      const result = smallStore.hit({
        key: "new-key",
        window: ONE_MINUTE,
        max: 100,
      });

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);

      smallStore.destroy();
    });
  });

  describe("retryAfter", () => {
    test("returns 0 when request is allowed", () => {
      const result = store.hit({
        key: "retry-key",
        window: ONE_MINUTE,
        max: 10,
      });

      expect(result.retryAfter).toBe(0);
    });

    test("returns positive value when request is blocked", () => {
      // Fill up
      for (let i = 0; i < 10; i++) {
        store.hit({ key: "retry-key", window: ONE_MINUTE, max: 10 });
      }

      const result = store.hit({
        key: "retry-key",
        window: ONE_MINUTE,
        max: 10,
      });

      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(ONE_MINUTE);
    });
  });

  describe("cleanup", () => {
    test("removes expired entries", async () => {
      // Create store with very short cleanup interval
      const cleanupStore = RateLimitStore.createTestInstance(50, 100);

      // Add entry with short window
      cleanupStore.hit({ key: "expire-key", window: 20, max: 10 });

      expect(cleanupStore.size).toBe(1);

      // Wait for window + cleanup
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 150);
      });

      expect(cleanupStore.size).toBe(0);

      cleanupStore.destroy();
    });
  });
});
