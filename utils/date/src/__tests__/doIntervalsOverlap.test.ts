import { describe, expect, test } from "bun:test";

import { intervalsOverlap } from "../intervalsOverlap";

describe("intervalsOverlap", () => {
  describe("string intervals (HH:MM)", () => {
    test("returns true when intervals overlap", () => {
      expect(
        intervalsOverlap(
          { startTime: "09:00", endTime: "12:00" },
          { startTime: "11:00", endTime: "14:00" },
        ),
      ).toBe(true);
    });

    test("returns false when intervals are adjacent (no overlap)", () => {
      expect(
        intervalsOverlap(
          { startTime: "09:00", endTime: "12:00" },
          { startTime: "12:00", endTime: "14:00" },
        ),
      ).toBe(false);
    });

    test("returns false when intervals are disjoint", () => {
      expect(
        intervalsOverlap(
          { startTime: "09:00", endTime: "10:00" },
          { startTime: "14:00", endTime: "16:00" },
        ),
      ).toBe(false);
    });

    test("returns true when one interval contains the other", () => {
      expect(
        intervalsOverlap(
          { startTime: "08:00", endTime: "17:00" },
          { startTime: "10:00", endTime: "12:00" },
        ),
      ).toBe(true);
    });
  });

  describe("Date intervals", () => {
    test("returns true when Date intervals overlap", () => {
      expect(
        intervalsOverlap(
          {
            startTime: new Date("2026-01-01T09:00:00"),
            endTime: new Date("2026-01-01T12:00:00"),
          },
          {
            startTime: new Date("2026-01-01T11:00:00"),
            endTime: new Date("2026-01-01T14:00:00"),
          },
        ),
      ).toBe(true);
    });

    test("returns false when Date intervals are adjacent", () => {
      expect(
        intervalsOverlap(
          {
            startTime: new Date("2026-01-01T09:00:00"),
            endTime: new Date("2026-01-01T12:00:00"),
          },
          {
            startTime: new Date("2026-01-01T12:00:00"),
            endTime: new Date("2026-01-01T14:00:00"),
          },
        ),
      ).toBe(false);
    });
  });

  describe("number intervals", () => {
    test("returns true when number intervals overlap", () => {
      expect(
        intervalsOverlap(
          { startTime: 0, endTime: 10 },
          { startTime: 5, endTime: 15 },
        ),
      ).toBe(true);
    });

    test("returns false when number intervals are adjacent", () => {
      expect(
        intervalsOverlap(
          { startTime: 0, endTime: 10 },
          { startTime: 10, endTime: 20 },
        ),
      ).toBe(false);
    });
  });
});
