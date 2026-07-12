import { toDateString } from "@blueprint/type-utils";
import { describe, expect, test } from "bun:test";

import { addDays } from "../addDays";
import { getFutureDateStr } from "../getFutureDateStr";

describe("getFutureDateStr", () => {
  test("returns a string in YYYY-MM-DD format", () => {
    const result = getFutureDateStr(1);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("is consistent with toDateString(addDays({ days: N }))", () => {
    for (const n of [1, 7, 30]) {
      expect(getFutureDateStr(n)).toBe(toDateString(addDays({ days: n })));
    }
  });

  test("consecutive days produce different strings", () => {
    const day1 = getFutureDateStr(1);
    const day2 = getFutureDateStr(2);
    expect(day1).not.toBe(day2);
  });
});
