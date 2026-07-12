import { describe, expect, test } from "bun:test";

import { uuidToInt32 } from "../uuidToInt32";

describe("uuidToInt32", () => {
  test("parses the first 8 hex chars of a hyphenated UUID", () => {
    expect(uuidToInt32("00000000-0000-0000-0000-000000000000")).toBe(0);
    expect(uuidToInt32("00000001-0000-0000-0000-000000000000")).toBe(1);
  });

  test("accepts a UUID without hyphens", () => {
    expect(uuidToInt32("00000001000000000000000000000000")).toBe(1);
  });

  test("returns a signed 32-bit integer for high-bit UUIDs", () => {
    expect(uuidToInt32("ffffffff-0000-0000-0000-000000000000")).toBe(-1);
    expect(uuidToInt32("80000000-0000-0000-0000-000000000000")).toBe(
      -2147483648,
    );
  });

  test("returns the max positive int32 for 0x7fffffff", () => {
    expect(uuidToInt32("7fffffff-0000-0000-0000-000000000000")).toBe(
      2147483647,
    );
  });

  test("ignores bits beyond the first 32", () => {
    const a = uuidToInt32("650e8400-e29b-41d4-a716-446655440001");
    const b = uuidToInt32("650e8400-ffff-ffff-ffff-ffffffffffff");
    expect(a).toBe(b);
  });

  test("returns different values for different UUIDs", () => {
    const a = uuidToInt32("650e8400-e29b-41d4-a716-446655440001");
    const b = uuidToInt32("750e8400-e29b-41d4-a716-446655440001");
    expect(a).not.toBe(b);
  });
});
