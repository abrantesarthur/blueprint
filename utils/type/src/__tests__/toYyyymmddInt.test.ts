import { describe, expect, test } from "bun:test";

import { toYyyymmddInt } from "../toYyyymmddInt";

describe("toYyyymmddInt", () => {
  test("packs a date as YYYYMMDD using local components", () => {
    expect(toYyyymmddInt(new Date(2026, 3, 20))).toBe(20260420);
  });

  test("pads single-digit months and days", () => {
    expect(toYyyymmddInt(new Date(2024, 0, 5))).toBe(20240105);
  });

  test("handles year boundaries correctly", () => {
    expect(toYyyymmddInt(new Date(2024, 11, 31, 23, 59))).toBe(20241231);
  });

  test("ignores time-of-day when packing", () => {
    const morning = toYyyymmddInt(new Date(2026, 3, 20, 0, 0));
    const evening = toYyyymmddInt(new Date(2026, 3, 20, 23, 59));
    expect(morning).toBe(evening);
  });

  test("returns a value that fits within int4", () => {
    const maxInt4 = 2_147_483_647;
    expect(toYyyymmddInt(new Date(9999, 11, 31))).toBeLessThan(maxInt4);
  });
});
