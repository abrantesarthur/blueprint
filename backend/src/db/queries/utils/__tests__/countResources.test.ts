import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import type { MockOtpCode } from "../../../../tests/mock-data/otpCodes/types";
import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent, testDb } from "../../../../tests/setup";
import { otpCodes, users } from "../../../schema";
import { countResources } from "../countResources";

describe("db/queries/utils/countResources.ts", () => {
  let carlosSilvaAB: MockUser;
  let mariaSantosB: MockUser;
  let otpCodeB: MockOtpCode;
  let otpCodeC: MockOtpCode;
  let otpCodeD: MockOtpCode;

  beforeAll(async () => {
    await agent.seed({
      users: [
        "carlosSilvaAB",
        "mariaSantosB",
        "joaoOliveiraBCD",
        "anaCostaAdmin",
      ],
      otpCodes: ["otpCodeB", "otpCodeC", "otpCodeD"],
    });

    carlosSilvaAB = agent.getFixture({ user: "carlosSilvaAB" });
    mariaSantosB = agent.getFixture({ user: "mariaSantosB" });
    otpCodeB = agent.getFixture({ otpCode: "otpCodeB" });
    otpCodeC = agent.getFixture({ otpCode: "otpCodeC" });
    otpCodeD = agent.getFixture({ otpCode: "otpCodeD" });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("simple count", () => {
    test("returns total count of all rows when no options provided", async () => {
      const result = await countResources({ table: users });

      // 3 regular users + 1 admin
      expect(result).toBe(4);
    });

    test("returns filtered count with where clause", async () => {
      const result = await countResources({
        table: users,
        where: { role: "user" },
      });

      expect(result).toBe(3);
    });

    test("returns 0 when no rows match the filter", async () => {
      const result = await countResources({
        table: users,
        where: { firstName: "NoSuchPerson" },
      });

      expect(result).toBe(0);
    });
  });

  describe("grouped count", () => {
    test("returns number when groupBy is empty array", async () => {
      const result = await countResources({
        table: users,
        groupBy: [],
      });

      expect(result).toBe(4);
    });

    test("groups by single column and returns array with groupBy column and count", async () => {
      const result = await countResources({
        table: users,
        groupBy: ["role"],
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        role: "user",
        count: 3,
      });
      expect(result).toContainEqual({
        role: "admin",
        count: 1,
      });
    });

    test("groups by multiple columns and returns array with all groupBy columns and count", async () => {
      const result = await countResources({
        table: users,
        groupBy: ["role", "phoneVerified"],
        where: { role: "user" },
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result).toContainEqual({
        role: "user",
        phoneVerified: false,
        count: 3,
      });
    });
  });

  describe("grouped count with include", () => {
    test("flattens main table namespace when grouping with include", async () => {
      const result = await countResources({
        table: users,
        groupBy: ["id", "otp_codes.id"],
        include: [{ table: otpCodes, on: eq(users.phone, otpCodes.phone) }],
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual({
        id: carlosSilvaAB.id,
        otp_code: { id: otpCodeC.id },
        count: 1,
      });
      expect(result).toContainEqual({
        id: mariaSantosB.id,
        otp_code: { id: otpCodeD.id },
        count: 1,
      });
    });

    test("preserves nested namespace for joined table columns in dot-notation groupBy", async () => {
      const result = await countResources({
        table: otpCodes,
        groupBy: ["users.role"],
        include: [{ table: users, on: eq(otpCodes.phone, users.phone) }],
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        user: { role: "user" },
        count: 2,
      });
      expect(result).toContainEqual({
        user: { role: "admin" },
        count: 1,
      });
    });
  });

  describe("grouped count with having", () => {
    test("filters grouped results using having clause with gte operator", async () => {
      const result = await countResources({
        table: users,
        groupBy: ["role"],
        having: { count: { value: 2, operator: "gte" } },
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result).toContainEqual({
        role: "user",
        count: 3,
      });
    });
  });

  describe("filtering by joined columns", () => {
    test("counts with a where filter on a joined-table column", async () => {
      const result = await countResources({
        table: otpCodes,
        include: [
          {
            table: users,
            attributes: [],
            on: eq(otpCodes.phone, users.phone),
          },
        ],
        where: { "users.id": carlosSilvaAB.id },
      });

      expect(result).toBe(1);
    });

    test("groups by a joined-column and filters by main-table column", async () => {
      const result = await countResources({
        table: otpCodes,
        groupBy: ["users.id"],
        include: [{ table: users, on: eq(otpCodes.phone, users.phone) }],
        where: { attempts: 0 },
      });

      expect(Array.isArray(result)).toBe(true);
      // Only otpCodeC (carlosSilvaAB) has 0 attempts among the seeded codes.
      expect(result).toContainEqual({
        user: { id: carlosSilvaAB.id },
        count: 1,
      });
    });

    test("counts with an `or` clause mixing main-table and joined-column filters", async () => {
      const result = await countResources({
        table: otpCodes,
        include: [
          {
            table: users,
            attributes: [],
            on: eq(otpCodes.phone, users.phone),
          },
        ],
        where: {
          or: [
            { attempts: otpCodeB.attempts },
            { "users.firstName": mariaSantosB.firstName },
          ],
        },
      });

      // otpCodeB (3 attempts) OR Maria's code (otpCodeD) => 2
      expect(result).toBe(2);
    });
  });

  describe("transaction support", () => {
    test("supports tx parameter for running count within a transaction", async () => {
      const result = await testDb.transaction(async (tx) => {
        return countResources({ table: users, tx });
      });

      expect(result).toBe(4);
    });
  });
});
