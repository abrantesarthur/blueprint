import { describe, expect, test } from "bun:test";

import { toDateString } from "../toDateString";

describe("toDateString", () => {
  test("returns a string in YYYY-MM-DD format", () => {
    const result = toDateString(new Date(2024, 0, 15));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("returns correct date for a known input", () => {
    const result = toDateString(new Date(2024, 5, 15, 12, 0));
    expect(result).toBe("2024-06-15");
  });

  test("uses local date components, not UTC", () => {
    // Construct a date at 23:30 local time on Jan 15.
    // In any timezone behind UTC (e.g. UTC-3), the UTC date
    // will be Jan 16, exposing the bug if toISOString is used.
    const date = new Date(2024, 0, 15, 23, 30);
    const result = toDateString(date);

    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    expect(result).toBe(expected);
  });

  test("handles year boundaries correctly", () => {
    const nye = new Date(2024, 11, 31, 23, 59);
    const result = toDateString(nye);
    expect(result).toBe("2024-12-31");
  });

  test("pads single-digit months and days", () => {
    const result = toDateString(new Date(2024, 0, 5));
    expect(result).toBe("2024-01-05");
  });
});
