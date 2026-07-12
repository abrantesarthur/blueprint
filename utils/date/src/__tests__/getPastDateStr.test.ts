import { describe, expect, test } from "bun:test";

import { getPastDateStr } from "../getPastDateStr";
import { getTodayStr } from "../getTodayStr";

describe("getPastDateStr", () => {
  test("returns a string in YYYY-MM-DD format", () => {
    const result = getPastDateStr(1);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("returns a date earlier than today", () => {
    const past = getPastDateStr(1);
    const today = getTodayStr();
    expect(past < today).toBe(true);
  });

  test("further in the past produces a lexicographically smaller string", () => {
    const past7 = getPastDateStr(7);
    const past1 = getPastDateStr(1);
    expect(past7 < past1).toBe(true);
  });
});
