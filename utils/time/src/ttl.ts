/**
 * Computes a TTL deadline by adding a duration to a base time.
 *
 * @param args - The inputs.
 * @param args.now - The base time.
 * @param args.ttlMs - The TTL duration in milliseconds.
 * @returns The deadline as a `Date`.
 */
export function ttl({ now, ttlMs }: { now: Date; ttlMs: number }): Date {
  return new Date(now.getTime() + ttlMs);
}
