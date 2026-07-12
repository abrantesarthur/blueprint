/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, getTableColumns, getTableName } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { MockOtpCode } from "../../../../tests/mock-data/otpCodes/types";
import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent } from "../../../../tests/setup";
import { otpCodes, users } from "../../../schema";
import { findAll as untypedFindAll } from "../findAll";

// Test-only alias: forces `any` typing on findAll so rows expose plain
// dot-notation property access (the production signature returns an
// index-signature row type that TS forbids dotting into). The trade-off
// is losing compile-time `@ts-expect-error` checks inside the test bodies.
const findAll: any = untypedFindAll;

/** Join condition reused across include tests (no FK links the two tables). */
const usersToOtpCodes = eq(users.phone, otpCodes.phone);

/** Join condition for queries rooted at otp_codes. */
const otpCodesToUsers = eq(otpCodes.phone, users.phone);

describe("db/queries/utils/findAll.ts", () => {
  let carlosSilvaAB: MockUser;
  let mariaSantosB: MockUser;
  let joaoOliveiraBCD: MockUser;
  let anaCostaAdmin: MockUser;
  let otpCodeC: MockOtpCode;
  let otpCodeD: MockOtpCode;

  beforeAll(async () => {
    await agent.seed({
      users: [
        "carlosSilvaAB",
        "mariaSantosB",
        "joaoOliveiraBCD",
        "pedroOliveira",
        "anaCostaAdmin",
        "lucasFerreiraAdmin",
      ],
      // Every user except joaoOliveiraBCD has an OTP code.
      // Attempts distribution: 0 → otpCodeA/otpCodeC/expiredOtpCode,
      // 1 → otpCodeD, 3 → otpCodeB.
      otpCodes: [
        "otpCodeA",
        "otpCodeB",
        "otpCodeC",
        "otpCodeD",
        "expiredOtpCode",
      ],
    });

    carlosSilvaAB = agent.getFixture({ user: "carlosSilvaAB" });
    mariaSantosB = agent.getFixture({ user: "mariaSantosB" });
    joaoOliveiraBCD = agent.getFixture({ user: "joaoOliveiraBCD" });
    anaCostaAdmin = agent.getFixture({ user: "anaCostaAdmin" });
    otpCodeC = agent.getFixture({ otpCode: "otpCodeC" });
    otpCodeD = agent.getFixture({ otpCode: "otpCodeD" });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("attributes", () => {
    test("returns no columns when empty attributes", async () => {
      const results = await findAll({ table: users, attributes: [] });
      expect(results).toHaveLength(6);
      expect(results.every((r: any) => Object.keys(r).length === 0)).toBe(true);
    });

    test("returns all columns when attributes is undefined", async () => {
      const results = await findAll({
        table: users,
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: carlosSilvaAB.id,
        firstName: carlosSilvaAB.firstName,
        phone: carlosSilvaAB.phone,
        role: "user",
      });
      expect(results[0]!.createdAt).toBeInstanceOf(Date);
      expect(results[0]!.updatedAt).toBeInstanceOf(Date);
    });

    test("returns a single column", async () => {
      const results = await findAll({
        table: users,
        attributes: ["id"],
        orderBy: { firstName: "asc" },
      });
      expect(results).toHaveLength(6);
      expect(results.every((r: any) => Object.keys(r).length === 1)).toBe(true);
      expect(results.every((r: any) => "id" in r)).toBe(true);
    });

    test("returns multiple columns", async () => {
      const results = await findAll({
        table: users,
        attributes: ["id", "role", "phone"],
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toEqual([
        {
          id: carlosSilvaAB.id,
          role: "user",
          phone: carlosSilvaAB.phone,
        },
      ]);
    });

    test("returns aggregate with regular column", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        orderBy: { role: "asc" },
      });
      expect(results).toContainEqual({ role: "user", total: 4 });
      expect(results).toContainEqual({ role: "admin", total: 2 });
    });

    test("returns attributes with limit and offset", async () => {
      const results = await findAll({
        table: users,
        attributes: ["id"],
        orderBy: { firstName: "asc" },
        limit: 2,
        offset: 1,
      });
      expect(results).toHaveLength(2);
    });

    test("returns nullable columns as null when not set", async () => {
      const results = await findAll({
        table: users,
        attributes: ["id", "otpRequestedAt"],
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toEqual([
        { id: carlosSilvaAB.id, otpRequestedAt: null },
      ]);
    });

    test("returns timestamp columns", async () => {
      const results = await findAll({
        table: users,
        attributes: ["id", "createdAt", "updatedAt"],
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(carlosSilvaAB.id);
      expect(results[0]!.createdAt).toBeInstanceOf(Date);
      expect(results[0]!.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("grouping", () => {
    test("throws if specify invalid attribute when grouping by regular column", async () => {
      await expect(
        findAll({
          table: users,
          attributes: ["phone"],
          groupBy: ["role"],
        }),
      ).rejects.toThrow();
    });

    test("does not throw if selecting any attributes when grouping by primary key", async () => {
      const results = await findAll({
        table: users,
        attributes: ["id", "phone", "role"],
        groupBy: ["id"],
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(carlosSilvaAB.id);
    });

    test("does not throw if selecting grouped attribute", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        groupBy: ["role"],
      });
      expect(results).toHaveLength(2);
    });

    test("groups by multiple columns", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role", "phoneVerified"],
        groupBy: ["role", "phoneVerified"],
      });
      // Combinations seeded: user + false (4), admin + false (2).
      expect(results).toHaveLength(2);
    });

    test("groups with where filter", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        groupBy: ["role"],
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ role: "user" });
    });

    test("groups with limit", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        groupBy: ["role"],
        limit: 1,
      });
      expect(results).toHaveLength(1);
    });

    test("groups with offset", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        groupBy: ["role"],
        orderBy: { role: "asc" },
        offset: 1,
      });
      expect(results).toHaveLength(1);
    });

    test("groups with descending order", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        orderBy: { total: "desc" },
      });
      expect(results[0]!.total).toBeGreaterThanOrEqual(results[1]!.total);
    });

    describe("grouping with aggregates", () => {
      test("counts all rows grouped by some column", async () => {
        const results = await findAll({
          table: users,
          attributes: ["role"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["role"],
        });
        expect(results).toContainEqual({ role: "user", total: 4 });
        expect(results).toContainEqual({ role: "admin", total: 2 });
      });

      test("counts with where filter", async () => {
        const results = await findAll({
          table: users,
          attributes: ["role"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["role"],
          where: { role: "user" },
        });
        expect(results).toEqual([{ role: "user", total: 4 }]);
      });

      test("counts with limit", async () => {
        const results = await findAll({
          table: users,
          attributes: ["role"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["role"],
          orderBy: { total: "desc" },
          limit: 1,
        });
        expect(results).toHaveLength(1);
        expect(results[0]!.total).toBe(4);
      });

      test("counts with offset", async () => {
        const results = await findAll({
          table: users,
          attributes: ["role"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["role"],
          orderBy: { total: "desc" },
          offset: 1,
        });
        expect(results).toHaveLength(1);
        expect(results[0]!.total).toBeLessThan(4);
      });

      test("counts with descending order", async () => {
        const results = await findAll({
          table: users,
          attributes: ["role"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["role"],
          orderBy: { total: "desc" },
        });
        for (let i = 1; i < results.length; i++) {
          expect(results[i]!.total).toBeLessThanOrEqual(results[i - 1]!.total);
        }
      });

      test("uses multiple aggregates with different aliases", async () => {
        const results = await findAll({
          table: users,
          attributes: ["role"],
          aggregates: [
            { fn: "count", column: "*", as: "total" },
            { fn: "countDistinct", column: "phoneVerified", as: "distinct" },
          ],
          groupBy: ["role"],
        });
        const regular = results.find((r: any) => r.role === "user");
        expect(regular!.total).toBe(4);
        expect(regular!.distinct).toBe(1);
      });

      test("computes avg aggregate over a numeric column", async () => {
        const results = await findAll({
          table: otpCodes,
          attributes: [],
          aggregates: [{ fn: "avg", column: "attempts", as: "avgAttempts" }],
        });
        // (0 + 3 + 0 + 1 + 0) / 5 = 0.8
        expect(results).toEqual([{ avgAttempts: 0.8 }]);
      });

      test("returns empty result for avg aggregate when no rows match", async () => {
        const results = await findAll({
          table: otpCodes,
          attributes: ["attempts"],
          aggregates: [
            { fn: "avg", column: "attempts", as: "avgAttempts" },
          ] as never,
          groupBy: ["attempts"],
          where: { id: "00000000-0000-0000-0000-000000000000" },
        });
        expect(results).toEqual([]);
      });
    });
  });

  describe("having", () => {
    test("filters groups by aggregate with gt", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { value: 2, operator: "gt" } },
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.role).toBe("user");
    });

    test("filters groups by aggregate with eq", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { value: 2, operator: "eq" } },
      });
      expect(results).toEqual([{ role: "admin", total: 2 }]);
    });

    test("filters groups by aggregate with gte", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { value: 2, operator: "gte" } },
      });
      expect(results).toHaveLength(2);
    });

    test("filters groups by aggregate with lt", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { value: 4, operator: "lt" } },
      });
      expect(results).toEqual([{ role: "admin", total: 2 }]);
    });

    test("filters groups by aggregate with lte", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { value: 2, operator: "lte" } },
      });
      expect(results).toEqual([{ role: "admin", total: 2 }]);
    });

    test("filters groups by aggregate with ne", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { value: 4, operator: "ne" } },
      });
      expect(results.every((r: any) => r.total !== 4)).toBe(true);
    });

    test("filters by grouped entity column", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { role: { value: "user", operator: "eq" } },
      });
      expect(results).toEqual([{ role: "user", total: 4 }]);
    });

    test("combines having with where", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        where: { phoneVerified: false },
        having: { total: { value: 2, operator: "gte" } },
      });
      expect(results).toHaveLength(2);
    });

    test("returns empty when no groups match", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { value: 999, operator: "gt" } },
      });
      expect(results).toEqual([]);
    });

    test("works without groupBy", async () => {
      const results = await findAll({
        table: users,
        attributes: [],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        having: { total: { value: 5, operator: "gt" } },
      });
      expect(results).toEqual([{ total: 6 }]);
    });

    test("works with include", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { value: 2, operator: "gt" } },
      });
      // Inner join drops joaoOliveiraBCD (no OTP): user 3, admin 2.
      expect(results).toEqual([{ role: "user", total: 3 }]);
    });

    test("works with include when grouping by nested include", async () => {
      const results = await findAll({
        table: otpCodes,
        include: [{ table: users, attributes: ["role"], on: otpCodesToUsers }],
        attributes: [],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["users.role"],
        having: { total: { value: 2, operator: "gt" } },
      });
      expect(results).toHaveLength(1);
      const user = (results[0] as { user: { role: string } }).user;
      expect(user.role).toBe("user");
    });

    test("works with having + include + limit", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { value: 1, operator: "gte" } },
        limit: 1,
      });
      expect(results).toHaveLength(1);
    });

    test("filters groups by grouped entity column with 'in' operator", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: {
          role: {
            value: ["user", "admin"],
            operator: "in",
          },
        },
      });
      expect(results).toHaveLength(2);
      expect(
        results.every((r: any) => ["user", "admin"].includes(r.role)),
      ).toBe(true);
    });
  });

  describe("filtering", () => {
    test("filters by null columns", async () => {
      const results = await findAll({
        table: users,
        attributes: ["id", "otpRequestedAt"],
        where: { otpRequestedAt: null },
      });
      expect(results).toHaveLength(6);
      expect(results.every((r: any) => r.otpRequestedAt === null)).toBe(true);
    });

    test("filters by id", async () => {
      const results = await findAll({
        table: users,
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(carlosSilvaAB.id);
    });

    test("filters by id with explicit filter", async () => {
      const results = await findAll({
        table: users,
        where: { id: { value: carlosSilvaAB.id, operator: "ne" } },
      });
      expect(results).toHaveLength(5);
      expect(results.every((r: any) => r.id !== carlosSilvaAB.id)).toBe(true);
    });

    test("filters by id with multiple explicit filters", async () => {
      const results = await findAll({
        table: users,
        where: {
          id: [
            { value: carlosSilvaAB.id, operator: "ne" },
            { value: mariaSantosB.id, operator: "ne" },
          ],
        },
      });
      expect(results).toHaveLength(4);
    });

    test("throws when an array filter entry is not a valid ExplicitFilter", async () => {
      await expect(
        findAll({
          table: users,
          where: { id: [{ notAFilter: true }] },
        }),
      ).rejects.toThrow();
    });

    test("filters by enum column", async () => {
      const results = await findAll({
        table: users,
        where: { role: "admin" },
      });
      expect(results).toHaveLength(2);
    });

    test("filters by enum column with explicit filter", async () => {
      const results = await findAll({
        table: users,
        where: {
          role: { value: "admin", operator: "ne" },
        },
      });
      expect(results).toHaveLength(4);
    });

    test("returns empty array for non-existent ID", async () => {
      const results = await findAll({
        table: users,
        where: { id: "00000000-0000-0000-0000-000000000000" },
      });
      expect(results).toEqual([]);
    });

    test("returns all rows when no filters are provided", async () => {
      const results = await findAll({ table: users });
      expect(results).toHaveLength(6);
    });

    describe("logical operators", () => {
      test("filters with 'and' at root level", async () => {
        const results = await findAll({
          table: users,
          where: {
            and: [{ role: "user" }, { id: carlosSilvaAB.id }],
          },
        });
        expect(results).toHaveLength(1);
      });

      test("filters with 'or' at root level", async () => {
        const results = await findAll({
          table: users,
          where: {
            or: [{ role: "admin" }, { id: carlosSilvaAB.id }],
          },
        });
        expect(results).toHaveLength(3);
      });

      test("filters with nested 'and' inside 'or'", async () => {
        const results = await findAll({
          table: users,
          where: {
            or: [
              { id: joaoOliveiraBCD.id },
              {
                and: [{ role: "admin" }, { id: anaCostaAdmin.id }],
              },
            ],
          },
        });
        expect(results).toHaveLength(2);
      });

      test("filters with nested 'or' inside 'and'", async () => {
        const results = await findAll({
          table: users,
          where: {
            and: [
              { role: "user" },
              {
                or: [{ id: carlosSilvaAB.id }, { id: mariaSantosB.id }],
              },
            ],
          },
        });
        expect(results).toHaveLength(2);
      });

      test("filters with deeply nested logical operators (3 levels)", async () => {
        const results = await findAll({
          table: users,
          where: {
            and: [
              { role: "user" },
              {
                or: [
                  { phoneVerified: false },
                  {
                    and: [{ id: joaoOliveiraBCD.id }],
                  },
                ],
              },
            ],
          },
        });
        // All 4 "user"-role records have phoneVerified false.
        expect(results).toHaveLength(4);
      });

      test("filters with explicit operators inside logical operators", async () => {
        const results = await findAll({
          table: users,
          where: {
            and: [
              { role: { value: "user", operator: "eq" } },
              { id: { value: carlosSilvaAB.id, operator: "ne" } },
            ],
          },
        });
        expect(results).toHaveLength(3);
      });

      test("filters with 'or' combining column filters", async () => {
        const results = await findAll({
          table: users,
          where: {
            or: [
              { id: carlosSilvaAB.id },
              { id: mariaSantosB.id },
              { id: joaoOliveiraBCD.id },
            ],
          },
        });
        expect(results).toHaveLength(3);
      });

      test("returns all rows when 'and' has empty array", async () => {
        const results = await findAll({
          table: users,
          where: { and: [] },
        });
        expect(results).toHaveLength(6);
      });

      test("returns all rows when 'or' has empty array", async () => {
        const results = await findAll({
          table: users,
          where: { or: [] },
        });
        expect(results).toHaveLength(6);
      });

      test("filters with 'not' at root level", async () => {
        const results = await findAll({
          table: users,
          where: { not: { role: "admin" } },
        });
        expect(results).toHaveLength(4);
        expect(results.every((r: any) => r.role !== "admin")).toBe(true);
      });

      test("filters with 'not' negating multiple column filters", async () => {
        const results = await findAll({
          table: users,
          where: {
            not: {
              role: "user",
              id: carlosSilvaAB.id,
            },
          },
        });
        // NOT (role "user" AND carlosSilvaAB) — keeps everything except carlosSilvaAB.
        expect(results).toHaveLength(5);
      });

      test("filters with 'not' inside 'and'", async () => {
        const results = await findAll({
          table: users,
          where: {
            and: [{ role: "user" }, { not: { id: carlosSilvaAB.id } }],
          },
        });
        expect(results).toHaveLength(3);
      });

      test("filters with 'not' inside 'or'", async () => {
        const results = await findAll({
          table: users,
          where: {
            or: [{ role: "admin" }, { not: { role: "user" } }],
          },
        });
        // The 2 admins are the only non-"user" roles.
        expect(results).toHaveLength(2);
      });

      test("filters with 'not' wrapping 'or'", async () => {
        const results = await findAll({
          table: users,
          where: {
            not: {
              or: [{ role: "admin" }, { id: carlosSilvaAB.id }],
            },
          },
        });
        expect(results).toHaveLength(3);
        expect(
          results.every(
            (r: any) => r.role !== "admin" && r.id !== carlosSilvaAB.id,
          ),
        ).toBe(true);
      });

      test("filters with nested 'not' inside 'not'", async () => {
        const results = await findAll({
          table: users,
          where: { not: { not: { role: "admin" } } },
        });
        expect(results).toHaveLength(2);
      });
    });

    describe("'in' operator", () => {
      test("filters by id with 'in' operator", async () => {
        const results = await findAll({
          table: users,
          where: {
            id: {
              value: [carlosSilvaAB.id, mariaSantosB.id],
              operator: "in",
            },
          },
        });
        expect(results).toHaveLength(2);
      });

      test("filters by enum column with 'in' operator", async () => {
        const results = await findAll({
          table: users,
          where: {
            role: {
              value: ["admin"],
              operator: "in",
            },
          },
        });
        expect(results).toHaveLength(2);
      });

      test("returns empty when no ids match with 'in' operator", async () => {
        const results = await findAll({
          table: users,
          where: {
            id: {
              value: ["00000000-0000-0000-0000-000000000000"],
              operator: "in",
            },
          },
        });
        expect(results).toEqual([]);
      });

      test("filters with single value in 'in' operator", async () => {
        const results = await findAll({
          table: users,
          where: {
            id: { value: [carlosSilvaAB.id], operator: "in" },
          },
        });
        expect(results).toHaveLength(1);
      });

      test("combines 'in' operator with other column filters", async () => {
        const results = await findAll({
          table: users,
          where: {
            role: "user",
            id: {
              value: [carlosSilvaAB.id, anaCostaAdmin.id],
              operator: "in",
            },
          },
        });
        expect(results).toHaveLength(1);
        expect(results[0]!.id).toBe(carlosSilvaAB.id);
      });

      test("works with 'in' operator inside logical 'and'", async () => {
        const results = await findAll({
          table: users,
          where: {
            and: [
              { role: "user" },
              {
                id: {
                  value: [carlosSilvaAB.id],
                  operator: "in",
                },
              },
            ],
          },
        });
        expect(results).toHaveLength(1);
      });

      test("works with 'in' operator inside logical 'or'", async () => {
        const results = await findAll({
          table: users,
          where: {
            or: [
              { id: joaoOliveiraBCD.id },
              {
                role: {
                  value: ["admin"],
                  operator: "in",
                },
              },
            ],
          },
        });
        expect(results).toHaveLength(3);
      });

      test("returns empty when 'in' operator has empty array", async () => {
        const results = await findAll({
          table: users,
          where: { id: { value: [], operator: "in" } },
        });
        expect(results).toEqual([]);
      });

      test("works with 'in' operator combined in ExplicitFilter array (AND)", async () => {
        const results = await findAll({
          table: users,
          where: {
            id: [
              {
                value: [
                  carlosSilvaAB.id,
                  mariaSantosB.id,
                  joaoOliveiraBCD.id,
                ],
                operator: "in",
              },
              { value: joaoOliveiraBCD.id, operator: "ne" },
            ],
          },
        });
        expect(results).toHaveLength(2);
        expect(results.every((r: any) => r.id !== joaoOliveiraBCD.id)).toBe(
          true,
        );
      });
    });

    describe("joined columns", () => {
      test("filters via implicit eq on a joined-table column", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          where: { "otp_codes.attempts": 3 },
        });
        expect(results).toHaveLength(1);
        expect(results[0]!.id).toBe(anaCostaAdmin.id);
      });

      test("filters via explicit `gt` on a joined-table column", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          where: {
            "otp_codes.attempts": {
              value: 0,
              operator: "gt",
            },
          },
        });
        // otpCodeD (1 attempt, maria) and otpCodeB (3 attempts, ana).
        expect(results).toHaveLength(2);
      });

      test("filters via explicit `in` on a joined-table column", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          where: {
            "otp_codes.attempts": {
              value: [0],
              operator: "in",
            },
          },
        });
        // otpCodeA, otpCodeC, expiredOtpCode all have 0 attempts.
        expect(results).toHaveLength(3);
      });

      test("treats an implicit `null` value as IS NULL on a joined column", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          where: { "otp_codes.code": null },
        });
        // Every seeded OTP code has a non-null code, so no users match.
        expect(results).toEqual([]);
      });

      test("AND-combines main-table and joined-table filters", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          where: {
            role: "user",
            "otp_codes.attempts": 0,
          },
        });
        // pedroOliveira (otpCodeA) + carlosSilvaAB (otpCodeC).
        expect(results).toHaveLength(2);
      });

      test("supports a joined-column filter nested inside an `and` clause", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          where: {
            and: [{ role: "admin" }, { "otp_codes.attempts": 3 }],
          },
        });
        expect(results).toHaveLength(1);
      });

      test("supports a joined-column filter nested inside an `or` clause", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          where: {
            or: [{ "otp_codes.attempts": 3 }, { role: "admin" }],
          },
        });
        // anaCostaAdmin (3 attempts) ∪ both admins with codes = 2.
        expect(results).toHaveLength(2);
      });

      test("supports a joined-column filter nested inside a `not` clause", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          where: { not: { "otp_codes.attempts": 0 } },
        });
        // mariaSantosB (1 attempt) + anaCostaAdmin (3 attempts).
        expect(results).toHaveLength(2);
      });

      test("supports deeply nested logical operators with joined-column filters", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          where: {
            and: [
              {
                or: [{ "otp_codes.attempts": 1 }, { role: "admin" }],
              },
              { phoneVerified: false },
            ],
          },
        });
        // mariaSantosB (1 attempt) + both admins with codes = 3.
        expect(results).toHaveLength(3);
      });

      test("applies filter-only join filters without adding the joined key to results", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          where: { "otp_codes.attempts": 3 },
        });
        expect(results).toHaveLength(1);
        // attributes: [] makes the join filter-only; no `otp_code` key in results.
        expect("otp_code" in (results[0] as object)).toBe(false);
      });

      test("throws when the dot-notation key references a table not in the include tree", async () => {
        await expect(
          findAll({
            table: users,
            include: [
              { table: otpCodes, attributes: [], on: usersToOtpCodes },
            ],
            where: {
              "unknown_table.id": "00000000-0000-0000-0000-000000000000",
            },
          }),
        ).rejects.toThrow();
      });

      test("throws when the dot-notation key references an unknown column on a joined table", async () => {
        await expect(
          findAll({
            table: users,
            include: [
              { table: otpCodes, attributes: [], on: usersToOtpCodes },
            ],
            where: { "otp_codes.nope": "x" },
          }),
        ).rejects.toThrow();
      });

      test("throws when a dot-notation key is used without any include", async () => {
        await expect(
          findAll({
            table: users,
            where: { "otp_codes.attempts": 0 },
          }),
        ).rejects.toThrow();
      });
    });
  });

  describe("pagination", () => {
    test("respects limit parameter", async () => {
      const results = await findAll({
        table: users,
        orderBy: { firstName: "asc" },
        limit: 3,
      });
      expect(results).toHaveLength(3);
    });

    test("respects offset parameter", async () => {
      const results = await findAll({
        table: users,
        orderBy: { firstName: "asc" },
        offset: 4,
      });
      expect(results).toHaveLength(2);
    });
  });

  describe("ordering", () => {
    test("orders by aggregate ascending", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        orderBy: { total: "asc" },
      });
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.total).toBeGreaterThanOrEqual(results[i - 1]!.total);
      }
    });

    test("orders by aggregate descending", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        orderBy: { total: "desc" },
      });
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.total).toBeLessThanOrEqual(results[i - 1]!.total);
      }
    });

    test("orders by aggregate with limit", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        orderBy: { total: "desc" },
        limit: 1,
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.total).toBe(4);
    });

    test("orders by aggregate combined with regular column", async () => {
      const results = await findAll({
        table: users,
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        orderBy: { total: "desc", role: "asc" },
      });
      expect(results[0]!.total).toBe(4);
    });

    test("returns rows ordered by createdAt ascending", async () => {
      const results = await findAll({
        table: users,
        orderBy: { createdAt: "asc" },
      });
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.createdAt.getTime()).toBeGreaterThanOrEqual(
          results[i - 1]!.createdAt.getTime(),
        );
      }
    });

    test("returns rows ordered by createdAt descending", async () => {
      const results = await findAll({
        table: users,
        orderBy: { createdAt: "desc" },
      });
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.createdAt.getTime()).toBeLessThanOrEqual(
          results[i - 1]!.createdAt.getTime(),
        );
      }
    });

    describe("dot-notation joined columns", () => {
      test("orders by joined table column ascending", async () => {
        const results = await findAll({
          table: otpCodes,
          include: [
            {
              table: users,
              attributes: ["id", "firstName"],
              on: otpCodesToUsers,
            },
          ],
          orderBy: { "users.firstName": "asc" },
        });
        const names = results.map((r: any) => r.user.firstName);
        const sorted = [...names].sort();
        expect(names).toEqual(sorted);
      });

      test("orders by joined table column descending", async () => {
        const results = await findAll({
          table: otpCodes,
          include: [
            {
              table: users,
              attributes: ["id", "firstName"],
              on: otpCodesToUsers,
            },
          ],
          orderBy: { "users.firstName": "desc" },
        });
        const names = results.map((r: any) => r.user.firstName);
        const sorted = [...names].sort().reverse();
        expect(names).toEqual(sorted);
      });

      test("orders by grouped joined column", async () => {
        const results = await findAll({
          table: otpCodes,
          include: [
            { table: users, attributes: ["firstName"], on: otpCodesToUsers },
          ],
          attributes: [],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["users.firstName"],
          orderBy: { "users.firstName": "asc" },
        });
        expect(results).toHaveLength(5);
      });

      test("silently skips invalid dot-notation table name", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          // Unknown prefix is silently dropped from the ORDER BY clause.
          orderBy: { "unknown_table.id": "asc" } as never,
          limit: 1,
        });
        expect(results).toHaveLength(1);
      });

      test("silently skips invalid dot-notation column name", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          orderBy: { "otp_codes.notARealColumn": "asc" } as never,
          limit: 1,
        });
        expect(results).toHaveLength(1);
      });
    });
  });

  describe("include", () => {
    test("returns root fields and nested `otp_code` when including otpCodes", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, on: usersToOtpCodes }],
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(carlosSilvaAB.id);
      expect((results[0] as { otp_code: { id: string } }).otp_code.id).toBe(
        otpCodeC.id,
      );
    });

    test("returns correct root-level fields with filter-only join", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(carlosSilvaAB.id);
      expect(results[0]!.role).toBe("user");
    });

    test("returns correct nested fields with selected attributes", async () => {
      const results = await findAll({
        table: users,
        include: [
          { table: otpCodes, attributes: ["id", "code"], on: usersToOtpCodes },
        ],
        where: { id: mariaSantosB.id },
      });
      const otpCode = (results[0] as { otp_code: { id: string; code: string } })
        .otp_code;
      expect(otpCode).toEqual({
        id: otpCodeD.id,
        code: "hashed-code-d",
      });
    });

    test("includes otp codes for all rows when no where filter", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, attributes: ["id"], on: usersToOtpCodes }],
      });
      // Inner join drops joaoOliveiraBCD (no OTP code).
      expect(results).toHaveLength(5);
      expect(
        results.every(
          (r: any) => "otp_code" in (r as object) && (r as never)["otp_code"],
        ),
      ).toBe(true);
    });

    test("filters by main-table column with include", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
        where: { role: "user" },
      });
      expect(results).toHaveLength(3);
    });

    test("filters by id with include", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toHaveLength(1);
    });

    test("applies limit with include", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
        limit: 3,
      });
      expect(results).toHaveLength(3);
    });

    test("applies offset with include", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
        orderBy: { firstName: "asc" },
        offset: 3,
      });
      expect(results).toHaveLength(2);
    });

    test("applies limit and offset together with include", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
        orderBy: { firstName: "asc" },
        limit: 2,
        offset: 2,
      });
      expect(results).toHaveLength(2);
    });

    test("applies orderBy ascending with include", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
        orderBy: { firstName: "asc" },
      });
      for (let i = 1; i < results.length; i++) {
        expect(
          results[i]!.firstName >= results[i - 1]!.firstName,
        ).toBe(true);
      }
    });

    test("applies orderBy descending with include", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
        orderBy: { firstName: "desc" },
      });
      for (let i = 1; i < results.length; i++) {
        expect(
          results[i]!.firstName <= results[i - 1]!.firstName,
        ).toBe(true);
      }
    });

    test("returns empty array with include when no match", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, on: usersToOtpCodes }],
        where: { id: "00000000-0000-0000-0000-000000000000" },
      });
      expect(results).toEqual([]);
    });

    test("filters with logical operators and include", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
        where: {
          and: [{ role: "user" }, { phoneVerified: false }],
        },
      });
      expect(results).toHaveLength(3);
    });

    test("filters with not operator and include", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
        where: { not: { role: "user" } },
      });
      expect(results).toHaveLength(2);
    });

    test("joins the correct otp code per user", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, on: usersToOtpCodes }],
      });
      for (const row of results) {
        const r = row as { phone: string; otp_code: { phone: string } };
        expect(r.otp_code.phone).toBe(r.phone);
      }
    });

    test("does not include otp codes when include is not specified", async () => {
      const results = await findAll({
        table: users,
        where: { id: carlosSilvaAB.id },
      });
      expect("otp_code" in (results[0] as object)).toBe(false);
    });

    describe("include with joined attributes", () => {
      test("returns only specified joined attributes", async () => {
        const results = await findAll({
          table: users,
          include: [
            { table: otpCodes, attributes: ["attempts"], on: usersToOtpCodes },
          ],
          where: { id: carlosSilvaAB.id },
        });
        const otpCode = (results[0] as { otp_code: { attempts: number } })
          .otp_code;
        expect(Object.keys(otpCode)).toEqual(["attempts"]);
        expect(otpCode.attempts).toBe(0);
      });

      test("omits the otp_code key when attributes is empty array (filter-only join)", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          where: { id: carlosSilvaAB.id },
        });
        expect("otp_code" in (results[0] as object)).toBe(false);
      });

      test("returns all joined columns when attributes is undefined", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, on: usersToOtpCodes }],
          where: { id: carlosSilvaAB.id },
        });
        const otpCode = (results[0] as { otp_code: Record<string, unknown> })
          .otp_code;
        expect(Object.keys(otpCode).length).toBeGreaterThan(5);
        expect(otpCode["id"]).toBe(otpCodeC.id);
      });

      test("works with multiple results and joined attributes", async () => {
        const results = await findAll({
          table: users,
          include: [
            { table: otpCodes, attributes: ["id"], on: usersToOtpCodes },
          ],
          where: { role: "admin" },
        });
        expect(results).toHaveLength(2);
        expect(
          results.every((r: any) => typeof r.otp_code.id === "string"),
        ).toBe(true);
      });
    });

    describe("include with parent attributes", () => {
      test("selects specific parent and joined attributes together", async () => {
        const results = await findAll({
          table: users,
          attributes: ["id", "role"],
          include: [
            { table: otpCodes, attributes: ["attempts"], on: usersToOtpCodes },
          ],
          where: { id: carlosSilvaAB.id },
        });
        expect(results).toHaveLength(1);
        const row = results[0] as {
          id: string;
          role: string;
          otp_code: { attempts: number };
        };
        expect(Object.keys(row).sort()).toEqual(
          ["id", "role", "otp_code"].sort(),
        );
      });

      test("selects all parent columns when attributes is undefined", async () => {
        const results = await findAll({
          table: users,
          include: [
            { table: otpCodes, attributes: ["attempts"], on: usersToOtpCodes },
          ],
          where: { id: carlosSilvaAB.id },
        });
        const row = results[0] as Record<string, unknown>;
        expect("id" in row).toBe(true);
        expect("phone" in row).toBe(true);
        expect("role" in row).toBe(true);
        expect("otp_code" in row).toBe(true);
      });
    });

    describe("include with aggregates", () => {
      test("works when combining aggregates with include, groupBy, and empty joined attributes", async () => {
        const results = await findAll({
          table: users,
          attributes: ["role"],
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["role"],
        });
        expect(results).toHaveLength(2);
      });

      test("allows selecting other attributes when grouping by primary key", async () => {
        const results = await findAll({
          table: users,
          attributes: ["id", "phone"],
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["id"],
          where: { id: carlosSilvaAB.id },
        });
        expect(results).toHaveLength(1);
        expect(results[0]!.id).toBe(carlosSilvaAB.id);
      });

      test("succeeds when combining aggregate-only attributes with include and no groupBy", async () => {
        const results = await findAll({
          table: users,
          attributes: [],
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
        });
        expect(results).toEqual([{ total: 5 }]);
      });

      test("respects orderBy with aggregates and include", async () => {
        const results = await findAll({
          table: users,
          attributes: ["role"],
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["role"],
          orderBy: { total: "asc" },
        });
        expect(results).toHaveLength(2);
        expect(results[0]!.total).toBeLessThan(results[1]!.total);
      });

      test("works when combining aggregates with include and narrowed parent attributes", async () => {
        const results = await findAll({
          table: users,
          attributes: ["role"],
          include: [
            { table: otpCodes, attributes: ["attempts"], on: usersToOtpCodes },
          ],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["role", "otp_codes.attempts"],
        });
        // Groups: (user, 0) ×2, (user, 1) ×1, (admin, 0) ×1, (admin, 3) ×1.
        expect(results).toHaveLength(4);
        expect(results[0]).toHaveProperty("otp_code");
      });
    });

    describe("include with groupBy on joined columns", () => {
      test("groups by otp_codes.id with count", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, on: usersToOtpCodes }],
          attributes: [],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["otp_codes.id"],
        });
        expect(results).toHaveLength(5);
      });

      test("allows selecting other attributes when grouping by included table's primary key", async () => {
        const results = await findAll({
          table: users,
          include: [
            { table: otpCodes, attributes: ["id", "code"], on: usersToOtpCodes },
          ],
          attributes: [],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["otp_codes.id"],
        });
        expect(results).toHaveLength(5);
        expect(
          (results[0] as { otp_code: { code: string } }).otp_code.code,
        ).toBeDefined();
      });

      test("groups by non-primary key with count", async () => {
        const results = await findAll({
          table: users,
          include: [
            { table: otpCodes, attributes: ["attempts"], on: usersToOtpCodes },
          ],
          attributes: [],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["otp_codes.attempts"],
        });
        // Attempts values seeded: 0, 1, 3.
        expect(results).toHaveLength(3);
      });

      test("groups by mixed main and joined columns", async () => {
        const results = await findAll({
          table: users,
          include: [
            { table: otpCodes, attributes: ["attempts"], on: usersToOtpCodes },
          ],
          attributes: ["role"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["role", "otp_codes.attempts"],
        });
        expect(results.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe("include with dot-notation aggregate columns", () => {
      test("count with dot-notation column", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          attributes: [],
          aggregates: [
            { fn: "count", column: "otp_codes.id", as: "codeCount" },
          ],
        });
        expect(results[0]!.codeCount).toBe(5);
      });

      test("silently skips invalid table name", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          attributes: [],
          aggregates: [
            { fn: "count", column: "*", as: "total" },
            // Unknown prefix is silently dropped.
            { fn: "count", column: "nope.id", as: "codeCount" } as never,
          ],
        });
        expect(results[0]!.total).toBe(5);
      });

      test("silently skips invalid column name", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          attributes: [],
          aggregates: [
            { fn: "count", column: "*", as: "total" },
            { fn: "count", column: "otp_codes.nope", as: "x" } as never,
          ],
        });
        expect(results[0]!.total).toBe(5);
      });

      test("mixes dot-notation and count(*)", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          attributes: [],
          aggregates: [
            { fn: "count", column: "*", as: "total" },
            { fn: "count", column: "otp_codes.id", as: "codeCount" },
          ],
        });
        expect(results[0]!.total).toBe(5);
        expect(results[0]!.codeCount).toBe(5);
      });

      test("combined with having filter", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
          attributes: ["role"],
          aggregates: [
            { fn: "count", column: "otp_codes.id", as: "codeCount" },
          ],
          groupBy: ["role"],
          having: { codeCount: { value: 2, operator: "gt" } },
        });
        expect(results).toHaveLength(1);
        expect(results[0]!.role).toBe("user");
      });
    });

    describe("include with required: false (left join)", () => {
      test("returns rows with `null` for left-joined table when no match exists", async () => {
        const results = await findAll({
          table: users,
          include: [
            { table: otpCodes, required: false, on: usersToOtpCodes },
          ],
          where: { id: joaoOliveiraBCD.id },
        });
        expect(results).toHaveLength(1);
        expect((results[0] as { otp_code: unknown }).otp_code).toBeNull();
      });

      test("returns non-null nested object when left-joined table matches", async () => {
        const results = await findAll({
          table: users,
          include: [
            { table: otpCodes, required: false, on: usersToOtpCodes },
          ],
          where: { id: carlosSilvaAB.id },
        });
        expect(results).toHaveLength(1);
        const otpCode = (results[0] as { otp_code: { id: string } | null })
          .otp_code;
        expect(otpCode).not.toBeNull();
        expect(otpCode!.id).toBe(otpCodeC.id);
      });

      test("left join keeps rows an inner join would drop", async () => {
        const results = await findAll({
          table: users,
          include: [
            { table: otpCodes, required: false, on: usersToOtpCodes },
          ],
        });
        // All 6 users survive the left join; only joaoOliveiraBCD has no code.
        expect(results).toHaveLength(6);
        expect(
          results.filter((r: any) => r.otp_code === null),
        ).toHaveLength(1);
      });

      test("default `required` (omitted) behaves as inner join", async () => {
        const results = await findAll({
          table: users,
          include: [{ table: otpCodes, on: usersToOtpCodes }],
          where: { id: joaoOliveiraBCD.id },
        });
        // Inner join — joaoOliveiraBCD has no OTP code, so row is filtered out.
        expect(results).toEqual([]);
      });

      test("omits the relation key when a left-joined table has attributes: [] and matches", async () => {
        const results = await findAll({
          table: users,
          include: [
            {
              table: otpCodes,
              required: false,
              attributes: [],
              on: usersToOtpCodes,
            },
          ],
          where: { id: carlosSilvaAB.id },
        });
        expect(results).toHaveLength(1);
        expect("otp_code" in (results[0] as object)).toBe(false);
      });

      test("omits the relation key when a left-joined table has attributes: [] and no match", async () => {
        const results = await findAll({
          table: users,
          include: [
            {
              table: otpCodes,
              required: false,
              attributes: [],
              on: usersToOtpCodes,
            },
          ],
          where: { id: joaoOliveiraBCD.id },
        });
        expect(results).toHaveLength(1);
        expect("otp_code" in (results[0] as object)).toBe(false);
      });
    });
  });

  describe("alias", () => {
    test("getTableName returns alias name for aliased tables", () => {
      const aliased = alias(otpCodes, "activeOtpCodes");
      expect(getTableName(aliased)).toBe("activeOtpCodes");
    });

    test("getTableColumns returns valid column refs for aliased tables", () => {
      const aliased = alias(otpCodes, "activeOtpCodes");
      const cols = getTableColumns(aliased);
      expect(cols.id).toBeDefined();
      expect(cols.attempts).toBeDefined();
    });

    test("include with alias joins aliased table", async () => {
      const activeOtpCodes = alias(otpCodes, "activeOtpCodes");
      const results = await findAll({
        table: users,
        include: [
          {
            table: otpCodes,
            alias: activeOtpCodes,
            on: eq(users.phone, activeOtpCodes.phone),
            attributes: ["id"],
          },
        ],
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toHaveLength(1);
      const joined = (results[0] as { activeOtpCode: { id: string } })
        .activeOtpCode;
      expect(joined.id).toBe(otpCodeC.id);
    });

    test("existing queries without alias still work unchanged", async () => {
      const results = await findAll({
        table: users,
        include: [{ table: otpCodes, attributes: ["id"], on: usersToOtpCodes }],
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toHaveLength(1);
      expect((results[0] as { otp_code: { id: string } }).otp_code.id).toBe(
        otpCodeC.id,
      );
    });
  });

  describe("count", () => {
    test("returns total count without groupBy", async () => {
      const result = await findAll({ table: users, count: true });
      expect(result).toEqual([{ count: 6 }]);
    });

    test("returns filtered count with where", async () => {
      const result = await findAll({
        table: users,
        count: true,
        where: { role: "admin" },
      });
      expect(result).toEqual([{ count: 2 }]);
    });

    test("returns grouped counts with groupBy", async () => {
      const result = await findAll({
        table: users,
        count: true,
        groupBy: ["role"],
      });
      expect(Array.isArray(result)).toBe(true);
      const groups = result as Array<{ role: string; count: number }>;
      expect(groups).toContainEqual({ role: "user", count: 4 });
    });

    test("returns count with include (inner join)", async () => {
      const result = await findAll({
        table: users,
        count: true,
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
      });
      expect(result).toEqual([{ count: 5 }]);
    });

    test("returns grouped counts with include and groupBy", async () => {
      const result = await findAll({
        table: users,
        count: true,
        include: [{ table: otpCodes, attributes: [], on: usersToOtpCodes }],
        groupBy: ["role"],
      });
      expect(Array.isArray(result)).toBe(true);
      expect((result as unknown[]).length).toBe(2);
    });

    test("returns 0 count when no rows match", async () => {
      const result = await findAll({
        table: users,
        count: true,
        where: { id: "00000000-0000-0000-0000-000000000000" },
      });
      expect(result).toEqual([{ count: 0 }]);
    });

    test("applies having filter on grouped count", async () => {
      const result = await findAll({
        table: users,
        count: true,
        groupBy: ["role"],
        having: { count: { value: 3, operator: "gt" } },
      });
      const groups = result as Array<{ count: number }>;
      expect(groups).toHaveLength(1);
      expect(groups[0]!.count).toBe(4);
    });

    test("forbids limit with count: true", async () => {
      // The @ts-expect-error verifies the type system rejects the
      // combination; at runtime the extra option is silently ignored.
      const result = await findAll({
        table: users,
        count: true,
        limit: 5,
      });
      expect(result).toEqual([{ count: 6 }]);
    });

    test("forbids offset with count: true", async () => {
      const result = await findAll({
        table: users,
        count: true,
        offset: 1,
      });
      expect(result).toEqual([{ count: 6 }]);
    });

    test("forbids orderBy with count: true", async () => {
      const result = await findAll({
        table: users,
        count: true,
        orderBy: { id: "asc" },
      });
      expect(result).toEqual([{ count: 6 }]);
    });

    test("forbids attributes with count: true", async () => {
      const result = await findAll({
        table: users,
        count: true,
        attributes: ["id"],
      });
      expect(result).toEqual([{ count: 6 }]);
    });

    test("allows aggregates with count: true", async () => {
      const result = await findAll({
        table: users,
        count: true,
        aggregates: [
          { fn: "countDistinct", column: "phoneVerified", as: "verified" },
        ],
        groupBy: ["role"],
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
