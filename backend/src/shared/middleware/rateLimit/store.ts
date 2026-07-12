import { ONE_MINUTE } from "@blueprint/time-utils";

import { MAX_STORE_ENTRIES } from "./constants";

/** Result returned by a rate limit check. */
export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Estimated current request count in window. */
  current: number;
  /** Maximum allowed requests. */
  limit: number;
  /** Milliseconds until rate limit resets (0 if allowed). */
  retryAfter: number;
  /** Remaining requests in current window. */
  remaining: number;
}

/** Bucket data for sliding window counter algorithm. */
interface Bucket {
  /** Count in previous window. */
  prevCount: number;
  /** Count in current window. */
  currCount: number;
  /** Start time of current window (ms since epoch). */
  windowStart: number;
  /** Window duration in milliseconds (needed for cleanup). */
  windowDuration: number;
}

/** Options for the hit method. */
interface HitOptions {
  /** Rate limit bucket key. */
  key: string;
  /** Window duration in milliseconds. */
  window: number;
  /** Maximum requests allowed. */
  max: number;
  /** Optional burst buffer (e.g., 0.1 for 10% over limit). */
  burstAllowance?: number;
}

/**
 * In-memory rate limit store using sliding window counter algorithm.
 * Provides O(1) space per key instead of O(n) with sliding window log.
 *
 * @example
 * ```typescript
 * const store = RateLimitStore.getInstance();
 * const result = store.hit({ key: "user:123", window: ONE_MINUTE, max: 30 });
 * if (!result.allowed) {
 *   throw new TooManyRequestsError();
 * }
 * ```
 */
export class RateLimitStore {
  /** Singleton instance. */
  private static instance: RateLimitStore | null = null;

  /** Map of key -> bucket. */
  private store = new Map<string, Bucket>();

  /** Cleanup interval handle. */
  private cleanupInterval: Timer | null = null;

  /** Maximum entries to prevent OOM during DDoS. */
  private readonly maxEntries: number;

  /**
   * Private constructor - use getInstance() instead.
   * @param cleanupIntervalMs - Interval for cleanup in milliseconds (default: 60s).
   * @param maxEntries - Maximum entries to prevent OOM (default: 100k).
   */
  private constructor(
    cleanupIntervalMs: number = ONE_MINUTE,
    maxEntries: number = MAX_STORE_ENTRIES,
  ) {
    this.maxEntries = maxEntries;
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  /**
   * Gets the singleton instance.
   * @returns The singleton RateLimitStore instance.
   */
  static getInstance(): RateLimitStore {
    if (!RateLimitStore.instance) {
      RateLimitStore.instance = new RateLimitStore();
    }
    return RateLimitStore.instance;
  }

  /** Resets singleton instance. Useful for tests. */
  static resetInstance(): void {
    if (RateLimitStore.instance) {
      RateLimitStore.instance.destroy();
      RateLimitStore.instance = null;
    }
  }

  /**
   * Creates an isolated instance for testing only.
   * @param cleanupIntervalMs - Interval for cleanup in milliseconds.
   * @param maxEntries - Maximum entries to prevent OOM.
   * @returns A new RateLimitStore instance.
   */
  static createTestInstance(
    cleanupIntervalMs: number,
    maxEntries: number,
  ): RateLimitStore {
    return new RateLimitStore(cleanupIntervalMs, maxEntries);
  }

  /**
   * Records a request and returns whether it's allowed.
   * @param options - The hit options containing key, window, max, and optional burstAllowance.
   * @returns The rate limit result with allowed status and metadata.
   */
  hit(options: HitOptions): RateLimitResult {
    const { key, window, max, burstAllowance = 0 } = options;
    const now: number = Date.now();
    let bucket: Bucket | undefined = this.store.get(key);

    if (!bucket) {
      // New key we haven't seen before - need to create a bucket.
      // First, ensure we have room (DDoS protection against IP spoofing).
      if (this.store.size >= this.maxEntries) {
        this.evictOldest(Math.floor(this.maxEntries * 0.2));
      }

      bucket = {
        prevCount: 0,
        currCount: 0,
        windowStart: now,
        windowDuration: window,
      };
    }

    // Check if we've moved to a new window
    const elapsed = now - bucket.windowStart;
    if (elapsed >= window) {
      // How many full windows have passed?
      const windowsPassed = Math.floor(elapsed / window);

      if (windowsPassed === 1) {
        // Moved to next window: current becomes previous
        bucket.prevCount = bucket.currCount;
        bucket.currCount = 0;
        bucket.windowStart += window;
      } else {
        // Multiple windows passed: reset everything
        bucket.prevCount = 0;
        bucket.currCount = 0;
        bucket.windowStart = now;
      }
    }

    // Calculate weighted count using sliding window
    const elapsedInWindow = now - bucket.windowStart;
    const weight = 1 - elapsedInWindow / window;
    const weightedCount = bucket.prevCount * weight + bucket.currCount;

    // Apply burst allowance
    const effectiveMax = max * (1 + burstAllowance);
    const allowed = weightedCount < effectiveMax;

    if (allowed) {
      bucket.currCount++;
      this.store.set(key, bucket);
    }

    // Calculate retry-after (time until enough requests expire)
    const retryAfter = allowed ? 0 : Math.ceil(window - elapsedInWindow);

    return {
      allowed,
      current: Math.ceil(weightedCount) + (allowed ? 1 : 0),
      limit: max,
      retryAfter,
      remaining: Math.max(
        0,
        max - Math.ceil(weightedCount) - (allowed ? 1 : 0),
      ),
    };
  }

  /**
   * Resets the rate limit for a key.
   * @param key - The rate limit bucket key to reset.
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Cleanup expired entries to prevent memory leaks.
   * Removes entries older than 2x the bucket's window duration.
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [key, bucket] of this.store.entries()) {
      const age = now - bucket.windowStart;
      // Remove if older than 2x the bucket's window duration
      if (age > bucket.windowDuration * 2) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Evicts oldest entries when store reaches max capacity (DDoS protection).
   * @param count - Number of entries to evict.
   */
  private evictOldest(count: number): void {
    // Sort entries by windowStart (oldest first)
    const entries = [...this.store.entries()]
      .sort((a, b) => a[1].windowStart - b[1].windowStart)
      .slice(0, count);

    for (const [key] of entries) {
      this.store.delete(key);
    }
  }

  /** Stops cleanup interval. Call during graceful shutdown. */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }

  /** Clears all rate limit entries. Useful for tests. */
  clear(): void {
    this.store.clear();
  }

  /**
   * Gets the current number of tracked keys (for monitoring).
   * @returns The number of keys currently in the store.
   */
  get size(): number {
    return this.store.size;
  }
}

/** Singleton store instance (60s cleanup, 100k max entries). */
export const rateLimitStore = RateLimitStore.getInstance();
