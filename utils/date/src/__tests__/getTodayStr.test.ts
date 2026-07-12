import { describe, expect, test } from "bun:test";

import { getTodayStr } from "../getTodayStr";

describe("getTodayStr", () => {
  test("returns a string in YYYY-MM-DD format", () => {
    const result = getTodayStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("matches today's local date derived independently", () => {
    const result = getTodayStr();
    // Derive today's date using local components (not UTC via toISOString)
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(result).toBe(expected);
  });
});
