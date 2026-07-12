import { describe, expect, test } from "bun:test";

import { toEpochMs } from "../toEpochMs";

describe("toEpochMs", () => {
  test("accepts a YYYY-MM-DD string and HH:MM time", () => {
    const result = toEpochMs({ date: "2026-03-15", time: "09:30" });
    expect(result).toBe(new Date("2026-03-15T09:30:00").getTime());
  });

  test("accepts a Date and converts using local components", () => {
    const date = new Date(2026, 2, 15, 23, 59, 59);
    const result = toEpochMs({ date, time: "08:00" });
    expect(result).toBe(new Date("2026-03-15T08:00:00").getTime());
  });

  test("throws on a malformed date string", () => {
    expect(() => toEpochMs({ date: "2026/03/15", time: "09:00" })).toThrow(
      /YYYY-MM-DD/,
    );
  });

  test("throws on a malformed time string", () => {
    expect(() => toEpochMs({ date: "2026-03-15", time: "9:00" })).toThrow(
      /HH:MM/,
    );
  });

  test("throws on out-of-range hour", () => {
    expect(() => toEpochMs({ date: "2026-03-15", time: "24:00" })).toThrow(
      /HH:MM/,
    );
  });

  test("throws on out-of-range minute", () => {
    expect(() => toEpochMs({ date: "2026-03-15", time: "10:60" })).toThrow(
      /HH:MM/,
    );
  });
});
