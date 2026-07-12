import { ONE_DAY } from "@blueprint/time-utils";
import { describe, expect, test } from "bun:test";

import { getNextDayOfWeekStr } from "../getNextDayOfWeekStr";

describe("getNextDayOfWeekStr", () => {
  test("returns a string in YYYY-MM-DD format", () => {
    const result = getNextDayOfWeekStr(0);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("returns a date that falls on the requested day of week", () => {
    const targetDay = 3; // Wednesday
    const result = getNextDayOfWeekStr(targetDay);
    const resultDate = new Date(result + "T00:00:00");
    expect(resultDate.getDay()).toBe(targetDay);
  });

  test("returns a future date, never today", () => {
    const today = new Date();
    const todayDay = today.getDay();
    const result = getNextDayOfWeekStr(todayDay);
    const resultDate = new Date(result + "T00:00:00");
    // Should be 7 days from now (next week's same day), not today
    expect(resultDate.getTime()).toBeGreaterThan(today.getTime());
  });

  test("returns the nearest future occurrence for a different day", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDay = today.getDay();
    // Pick a day that is 2 days ahead
    const targetDay = (todayDay + 2) % 7;
    const result = getNextDayOfWeekStr(targetDay);
    const resultDate = new Date(result + "T00:00:00");
    const diffDays = (resultDate.getTime() - today.getTime()) / ONE_DAY;
    expect(diffDays).toBe(2);
  });
});
