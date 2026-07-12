import { ONE_DAY } from "@blueprint/time-utils";
import { describe, expect, test } from "bun:test";

import { getNextDayOfWeek } from "../getNextDayOfWeek";

describe("getNextDayOfWeek", () => {
  test("returns a Date object", () => {
    const result = getNextDayOfWeek(0);
    expect(result).toBeInstanceOf(Date);
  });

  test("returns a date at midnight", () => {
    const result = getNextDayOfWeek(1);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  test("returns a date that falls on the requested day of week", () => {
    const targetDay = 5; // Friday
    const result = getNextDayOfWeek(targetDay);
    expect(result.getDay()).toBe(targetDay);
  });

  test("returns next week when the target day is today", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDay = today.getDay();
    const result = getNextDayOfWeek(todayDay);
    const diffDays = (result.getTime() - today.getTime()) / ONE_DAY;
    expect(diffDays).toBe(7);
  });

  test("returns the nearest future occurrence for a different day", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDay = today.getDay();
    // Pick a day that is 3 days ahead
    const targetDay = (todayDay + 3) % 7;
    const result = getNextDayOfWeek(targetDay);
    const diffDays = (result.getTime() - today.getTime()) / ONE_DAY;
    expect(diffDays).toBe(3);
  });
});
