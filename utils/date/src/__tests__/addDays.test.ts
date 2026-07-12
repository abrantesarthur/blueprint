import { ONE_DAY } from "@blueprint/time-utils";
import { describe, expect, test } from "bun:test";

import { addDays } from "../addDays";

describe("addDays", () => {
  test("defaults to 1 day from today", () => {
    const result = addDays();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    expect(result.getTime()).toBe(tomorrow.getTime());
  });

  test("days: 0 returns today at midnight", () => {
    const result = addDays({ days: 0 });
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    expect(result.getTime()).toBe(now.getTime());
  });

  test("each additional day adds the expected time", () => {
    const day5 = addDays({ days: 5 });
    const day6 = addDays({ days: 6 });
    expect(day6.getTime() - day5.getTime()).toBe(ONE_DAY);
  });

  test("accepts a Date as 'from'", () => {
    const from = new Date("2026-03-15");
    const result = addDays({ from, days: 3 });
    expect(result.getDate()).toBe(18);
  });

  test("accepts a string as 'from'", () => {
    const result = addDays({ from: "2026-01-01", days: 1 });
    expect(result.getDate()).toBe(2);
  });

  test("handles month boundary", () => {
    const result = addDays({ from: new Date("2026-01-31") });
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(1);
  });

  test("handles year boundary", () => {
    const result = addDays({ from: new Date("2025-12-31") });
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  test("supports negative days", () => {
    const result = addDays({ from: new Date("2026-03-15"), days: -3 });
    expect(result.getDate()).toBe(12);
  });

  test("does not mutate the input date", () => {
    const input = new Date("2026-03-15");
    const originalTime = input.getTime();
    addDays({ from: input, days: 5 });
    expect(input.getTime()).toBe(originalTime);
  });

  test("resets time to midnight", () => {
    const input = new Date("2026-03-15T14:30:00");
    const result = addDays({ from: input, days: 1 });
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});
