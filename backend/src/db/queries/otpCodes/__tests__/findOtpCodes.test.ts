import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { MockOtpCode } from "../../../../tests/mock-data/otpCodes/types";
import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent } from "../../../../tests/setup";
import { findOtpCodes } from "..";

describe("db/queries/otpCodes/findOtpCodes.ts", () => {
  let pedroOliveira: MockUser;
  let anaCostaAdmin: MockUser;
  let otpA: MockOtpCode;
  let otpB: MockOtpCode;

  beforeAll(async () => {
    await agent.seed({
      users: ["pedroOliveira", "anaCostaAdmin"],
      otpCodes: ["otpCodeA", "otpCodeB"],
    });

    pedroOliveira = agent.getFixture({ user: "pedroOliveira" });
    anaCostaAdmin = agent.getFixture({ user: "anaCostaAdmin" });
    otpA = agent.getFixture({ otpCode: "otpCodeA" });
    otpB = agent.getFixture({ otpCode: "otpCodeB" });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("attributes", () => {
    test("returns no columns when empty attributes", async () => {
      const results = await findOtpCodes({
        attributes: [],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { createdAt: "asc" },
      });

      expect(results).toEqual([{}, {}]);
    });

    test("returns a single column with orderBy", async () => {
      const results = await findOtpCodes({
        attributes: ["id"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { createdAt: "asc", id: "asc" },
      });

      expect(results).toEqual([{ id: otpA.id }, { id: otpB.id }]);
    });

    test("returns multiple columns with orderBy", async () => {
      const results = await findOtpCodes({
        attributes: ["id", "phone", "attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { createdAt: "asc", id: "asc" },
      });

      expect(results).toEqual([
        {
          id: otpA.id,
          phone: pedroOliveira.phone,
          attempts: 0,
        },
        {
          id: otpB.id,
          phone: anaCostaAdmin.phone,
          attempts: 3,
        },
      ]);
    });

    test("returns aggregate with regular column", async () => {
      const results = await findOtpCodes({
        attributes: ["attempts"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        groupBy: ["attempts"],
        orderBy: { attempts: "asc" },
      });

      expect(results).toEqual([
        { attempts: 0, total: 1 },
        { attempts: 3, total: 1 },
      ]);
    });

    test("returns attributes with where filter", async () => {
      const results = await findOtpCodes({
        attributes: ["id", "code"],
        where: { phone: pedroOliveira.phone },
      });

      expect(results).toEqual([{ id: otpA.id, code: "hashed-code-a" }]);
    });

    test("returns attributes with limit and offset", async () => {
      const results = await findOtpCodes({
        attributes: ["id"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { createdAt: "asc", id: "asc" },
        limit: 1,
        offset: 1,
      });

      expect(results).toEqual([{ id: otpB.id }]);
    });

    test("returns timestamp columns", async () => {
      const results = await findOtpCodes({
        attributes: ["id", "createdAt", "updatedAt"],
        where: { id: otpA.id },
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(otpA.id);
      expect(results[0]!.createdAt).toBeInstanceOf(Date);
      expect(results[0]!.updatedAt).toBeInstanceOf(Date);
    });

    test("returns expiresAt column", async () => {
      const results = await findOtpCodes({
        attributes: ["id", "expiresAt"],
        where: { id: otpA.id },
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(otpA.id);
      expect(results[0]!.expiresAt).toBeInstanceOf(Date);
      expect(results[0]!.expiresAt.toISOString()).toBe(
        "2099-01-01T00:00:00.000Z",
      );
    });
  });

  describe("grouping", () => {
    test("throws if specifying non-grouped attribute when grouping by non-PK column", async () => {
      await expect(
        findOtpCodes({
          groupBy: ["phone"],
          attributes: ["phone", "code"],
          where: { or: [{ id: otpA.id }, { id: otpB.id }] },
          orderBy: { phone: "asc" },
        }),
      ).rejects.toThrow(Error);
    });

    test("does not throw when selecting any attributes when grouping by primary key", async () => {
      const results = await findOtpCodes({
        groupBy: ["id"],
        attributes: ["id", "phone"],
        aggregates: [{ fn: "count", column: "*", as: "count" }],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { id: "asc" },
      });

      const sorted = [...results].sort((a, b) => a.id.localeCompare(b.id));
      expect(results).toEqual(sorted);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.count === 1)).toBe(true);
    });

    test("groups by attempts", async () => {
      const results = await findOtpCodes({
        groupBy: ["attempts"],
        attributes: ["attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { attempts: "asc" },
      });

      expect(results).toEqual([{ attempts: 0 }, { attempts: 3 }]);
    });

    test("groups by phone", async () => {
      const results = await findOtpCodes({
        groupBy: ["phone"],
        attributes: ["phone"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { phone: "asc" },
      });

      expect(results).toEqual([
        { phone: pedroOliveira.phone },
        { phone: anaCostaAdmin.phone },
      ]);
    });

    test("groups with where filter", async () => {
      const results = await findOtpCodes({
        groupBy: ["attempts"],
        attributes: ["attempts"],
        where: {
          and: [{ attempts: 0 }, { or: [{ id: otpA.id }, { id: otpB.id }] }],
        },
      });

      expect(results).toEqual([{ attempts: 0 }]);
    });

    test("groups with limit", async () => {
      const results = await findOtpCodes({
        groupBy: ["attempts"],
        attributes: ["attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { attempts: "asc" },
        limit: 1,
      });

      expect(results).toEqual([{ attempts: 0 }]);
    });

    test("groups with offset", async () => {
      const results = await findOtpCodes({
        groupBy: ["attempts"],
        attributes: ["attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { attempts: "asc" },
        offset: 1,
      });

      expect(results).toEqual([{ attempts: 3 }]);
    });

    test("groups with descending order on attempts", async () => {
      const results = await findOtpCodes({
        groupBy: ["attempts"],
        attributes: ["attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { attempts: "desc" },
      });

      expect(results).toEqual([{ attempts: 3 }, { attempts: 0 }]);
    });

    describe("grouping with aggregates", () => {
      test("count grouped by attempts", async () => {
        const results = await findOtpCodes({
          groupBy: ["attempts"],
          attributes: ["attempts"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          where: { or: [{ id: otpA.id }, { id: otpB.id }] },
          orderBy: { attempts: "asc" },
        });

        expect(results).toEqual([
          { attempts: 0, total: 1 },
          { attempts: 3, total: 1 },
        ]);
      });

      test("count with where filter", async () => {
        const results = await findOtpCodes({
          groupBy: ["attempts"],
          attributes: ["attempts"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          where: {
            and: [
              { or: [{ attempts: 0 }, { attempts: 3 }] },
              { or: [{ id: otpA.id }, { id: otpB.id }] },
            ],
          },
          orderBy: { attempts: "asc" },
        });

        expect(results).toEqual([
          { attempts: 0, total: 1 },
          { attempts: 3, total: 1 },
        ]);
      });

      test("count with limit", async () => {
        const results = await findOtpCodes({
          groupBy: ["attempts"],
          attributes: ["attempts"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          where: { or: [{ id: otpA.id }, { id: otpB.id }] },
          orderBy: { attempts: "asc" },
          limit: 1,
        });

        expect(results).toEqual([{ attempts: 0, total: 1 }]);
      });

      test("count with offset", async () => {
        const results = await findOtpCodes({
          groupBy: ["attempts"],
          attributes: ["attempts"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          where: { or: [{ id: otpA.id }, { id: otpB.id }] },
          orderBy: { attempts: "asc" },
          offset: 1,
        });

        expect(results).toEqual([{ attempts: 3, total: 1 }]);
      });

      test("count with descending order", async () => {
        const results = await findOtpCodes({
          groupBy: ["attempts"],
          attributes: ["attempts"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          where: { or: [{ id: otpA.id }, { id: otpB.id }] },
          orderBy: { attempts: "desc" },
        });

        expect(results).toEqual([
          { attempts: 3, total: 1 },
          { attempts: 0, total: 1 },
        ]);
      });

      test("count on specific column", async () => {
        const results = await findOtpCodes({
          groupBy: ["attempts"],
          attributes: ["attempts"],
          aggregates: [{ fn: "count", column: "id", as: "idCount" }],
          where: { or: [{ id: otpA.id }, { id: otpB.id }] },
          orderBy: { attempts: "asc" },
        });

        expect(results).toEqual([
          { attempts: 0, idCount: 1 },
          { attempts: 3, idCount: 1 },
        ]);
      });

      test("multiple aggregates with different aliases", async () => {
        const results = await findOtpCodes({
          groupBy: ["attempts"],
          attributes: ["attempts"],
          aggregates: [
            { fn: "count", column: "*", as: "total" },
            { fn: "count", column: "id", as: "idCount" },
          ],
          where: { or: [{ id: otpA.id }, { id: otpB.id }] },
          orderBy: { attempts: "asc" },
        });

        expect(results).toEqual([
          { attempts: 0, total: 1, idCount: 1 },
          { attempts: 3, total: 1, idCount: 1 },
        ]);
      });
    });
  });

  describe("having", () => {
    test("filters groups by aggregate with gt", async () => {
      const results = await findOtpCodes({
        attributes: ["attempts"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        having: { total: { operator: "gt", value: 0 } },
        orderBy: { attempts: "asc" },
      });

      expect(results).toEqual([
        { attempts: 0, total: 1 },
        { attempts: 3, total: 1 },
      ]);
    });

    test("filters groups by aggregate with eq", async () => {
      const results = await findOtpCodes({
        attributes: ["attempts"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        having: { attempts: { operator: "eq", value: 0 } },
      });

      expect(results).toEqual([{ attempts: 0, total: 1 }]);
    });

    test("filters groups by aggregate with gte", async () => {
      const results = await findOtpCodes({
        attributes: ["attempts"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        having: { total: { operator: "gte", value: 1 } },
        orderBy: { attempts: "asc" },
      });

      expect(results).toEqual([
        { attempts: 0, total: 1 },
        { attempts: 3, total: 1 },
      ]);
    });

    test("filters groups by aggregate with lt", async () => {
      const results = await findOtpCodes({
        attributes: ["attempts"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        having: { total: { operator: "lt", value: 2 } },
        orderBy: { attempts: "asc" },
      });

      expect(results).toEqual([
        { attempts: 0, total: 1 },
        { attempts: 3, total: 1 },
      ]);
    });

    test("filters groups by aggregate with lte", async () => {
      const results = await findOtpCodes({
        attributes: ["attempts"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        having: { attempts: { operator: "lte", value: 0 } },
      });

      expect(results).toEqual([{ attempts: 0, total: 1 }]);
    });

    test("filters groups by aggregate with ne", async () => {
      const results = await findOtpCodes({
        attributes: ["attempts"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        having: { attempts: { operator: "ne", value: 3 } },
      });

      expect(results).toEqual([{ attempts: 0, total: 1 }]);
    });

    test("filters by grouped entity column", async () => {
      const results = await findOtpCodes({
        attributes: ["attempts"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        having: { attempts: { operator: "eq", value: 3 } },
      });

      expect(results).toEqual([{ attempts: 3, total: 1 }]);
    });

    test("combines aggregate and column having", async () => {
      const results = await findOtpCodes({
        attributes: ["attempts"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        having: {
          total: { operator: "gte", value: 1 },
          attempts: { operator: "eq", value: 3 },
        },
      });

      expect(results).toEqual([{ attempts: 3, total: 1 }]);
    });

    test("combines having with where", async () => {
      const results = await findOtpCodes({
        attributes: ["attempts"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["attempts"],
        where: {
          and: [
            { not: { attempts: 0 } },
            { or: [{ id: otpA.id }, { id: otpB.id }] },
          ],
        },
        having: { total: { operator: "gt", value: 0 } },
      });

      expect(results).toEqual([{ attempts: 3, total: 1 }]);
    });

    test("returns empty when no groups match", async () => {
      const results = await findOtpCodes({
        attributes: ["attempts"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["attempts"],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        having: { total: { operator: "gt", value: 100 } },
      });

      expect(results).toEqual([]);
    });

    test("works without groupBy", async () => {
      const results = await findOtpCodes({
        attributes: [],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        having: { total: { operator: "gt", value: 1 } },
      });

      expect(results).toEqual([{ total: 2 }]);
    });
  });

  describe("filtering", () => {
    test("filters by id", async () => {
      const result = await findOtpCodes({
        where: { id: otpA.id },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: otpA.id });
    });

    test("filters by id with explicit filter", async () => {
      const result = await findOtpCodes({
        where: {
          and: [
            { id: { operator: "ne", value: otpA.id } },
            { or: [{ id: otpA.id }, { id: otpB.id }] },
          ],
        },
      });

      expect(result).toHaveLength(1);
      expect(result.filter((r) => r.id === otpA.id)).toBeEmpty();
    });

    test("filters by phone", async () => {
      const result = await findOtpCodes({
        where: { phone: pedroOliveira.phone },
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.phone).toBe(pedroOliveira.phone);
    });

    test("filters by code", async () => {
      const result = await findOtpCodes({
        where: { code: "hashed-code-a" },
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.code).toBe("hashed-code-a");
    });

    test("filters by attempts", async () => {
      const result = await findOtpCodes({
        where: { attempts: 3 },
      });

      expect(result).toHaveLength(1);
      expect(result.every((r) => r.attempts === 3)).toBe(true);
    });

    test("filters by attempts with explicit filter", async () => {
      const result = await findOtpCodes({
        where: { attempts: { operator: "gte", value: 3 } },
      });

      expect(result).toHaveLength(1);
      expect(result.every((r) => r.attempts >= 3)).toBe(true);
    });

    test("filters by expiresAt with explicit filter", async () => {
      const result = await findOtpCodes({
        where: {
          and: [
            {
              expiresAt: {
                operator: "lte",
                value: new Date("2099-03-01T00:00:00.000Z"),
              },
            },
            { or: [{ id: otpA.id }, { id: otpB.id }] },
          ],
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(otpA.id);
    });

    test("returns empty for non-existent ID", async () => {
      const result = await findOtpCodes({
        where: { id: "00000000-0000-0000-0000-000000000000" },
      });

      expect(result).toEqual([]);
    });

    test("returns all when no filters", async () => {
      const result = await findOtpCodes({
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
      });

      expect(result).toHaveLength(2);
    });

    describe("logical operators", () => {
      test("filters with 'and' at root level", async () => {
        const result = await findOtpCodes({
          where: {
            and: [{ phone: pedroOliveira.phone }, { id: otpA.id }],
          },
        });

        expect(result).toHaveLength(1);
        expect(result[0]!.id).toBe(otpA.id);
      });

      test("filters with 'or' at root level", async () => {
        const result = await findOtpCodes({
          where: {
            and: [
              { or: [{ attempts: 0 }, { attempts: 3 }] },
              { or: [{ id: otpA.id }, { id: otpB.id }] },
            ],
          },
        });

        expect(result).toHaveLength(2);
        expect(result.every((r) => r.attempts === 0 || r.attempts === 3)).toBe(
          true,
        );
      });

      test("filters with nested 'and' inside 'or'", async () => {
        const result = await findOtpCodes({
          where: {
            and: [
              {
                or: [
                  { attempts: 0 },
                  {
                    and: [{ attempts: 3 }, { id: otpB.id }],
                  },
                ],
              },
              { or: [{ id: otpA.id }, { id: otpB.id }] },
            ],
          },
        });

        expect(result).toHaveLength(2);
        expect(
          result.every(
            (r) => r.attempts === 0 || (r.attempts === 3 && r.id === otpB.id),
          ),
        ).toBe(true);
      });

      test("filters with nested 'or' inside 'and'", async () => {
        const result = await findOtpCodes({
          where: {
            and: [
              { attempts: 0 },
              {
                or: [{ id: otpA.id }, { id: otpB.id }],
              },
            ],
          },
        });

        expect(result).toHaveLength(1);
        expect(
          result.every(
            (r) => r.attempts === 0 && (r.id === otpA.id || r.id === otpB.id),
          ),
        ).toBe(true);
      });

      test("filters with explicit operators inside logical operators", async () => {
        const result = await findOtpCodes({
          where: {
            and: [
              { attempts: { operator: "eq", value: 3 } },
              { id: { operator: "ne", value: otpA.id } },
            ],
          },
        });

        expect(result).toHaveLength(1);
        expect(result.every((r) => r.attempts === 3 && r.id !== otpA.id)).toBe(
          true,
        );
      });

      test("returns all when 'and' has empty array", async () => {
        const result = await findOtpCodes({
          where: { and: [{ or: [{ id: otpA.id }, { id: otpB.id }] }] },
        });

        expect(result).toHaveLength(2);
      });

      test("returns all when 'or' has empty array", async () => {
        const result = await findOtpCodes({
          where: {
            and: [{ or: [] }, { or: [{ id: otpA.id }, { id: otpB.id }] }],
          },
        });

        expect(result).toHaveLength(2);
      });

      test("filters with 'not' at root level", async () => {
        const result = await findOtpCodes({
          where: {
            and: [
              { not: { attempts: 3 } },
              { or: [{ id: otpA.id }, { id: otpB.id }] },
            ],
          },
        });

        expect(result).toHaveLength(1);
        expect(result.every((r) => r.attempts !== 3)).toBe(true);
      });

      test("filters with 'not' inside 'and'", async () => {
        const result = await findOtpCodes({
          where: {
            and: [
              { attempts: 0 },
              { not: { id: otpB.id } },
              { or: [{ id: otpA.id }, { id: otpB.id }] },
            ],
          },
        });

        expect(result).toHaveLength(1);
        expect(result.every((r) => r.attempts === 0 && r.id !== otpB.id)).toBe(
          true,
        );
      });

      test("filters with 'not' wrapping 'or'", async () => {
        const result = await findOtpCodes({
          where: {
            and: [
              {
                not: {
                  or: [{ attempts: 0 }, { attempts: 3 }],
                },
              },
              { or: [{ id: otpA.id }, { id: otpB.id }] },
            ],
          },
        });

        expect(result).toEqual([]);
      });

      test("filters with nested 'not' inside 'not'", async () => {
        const result = await findOtpCodes({
          where: {
            and: [
              {
                not: {
                  not: { attempts: 0 },
                },
              },
              { or: [{ id: otpA.id }, { id: otpB.id }] },
            ],
          },
        });

        expect(result).toHaveLength(1);
        expect(result.every((r) => r.attempts === 0)).toBe(true);
      });
    });
  });

  describe("pagination", () => {
    test("respects limit", async () => {
      const result = await findOtpCodes({
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { createdAt: "asc", id: "asc" },
        limit: 1,
      });

      expect(result).toHaveLength(1);
    });

    test("respects offset", async () => {
      const allResults = await findOtpCodes({
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { createdAt: "asc", id: "asc" },
      });

      const result = await findOtpCodes({
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { createdAt: "asc", id: "asc" },
        offset: 1,
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(allResults[1]!.id);
    });
  });

  describe("ordering", () => {
    test("ascending by createdAt", async () => {
      const result = await findOtpCodes({
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { createdAt: "asc", id: "asc" },
      });

      expect(result).toHaveLength(2);

      for (let i = 1; i < result.length; i++) {
        const prev = new Date(result[i - 1]!.createdAt).getTime();
        const curr = new Date(result[i]!.createdAt).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    test("descending by createdAt", async () => {
      const result = await findOtpCodes({
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { createdAt: "desc", id: "desc" },
      });

      expect(result).toHaveLength(2);

      for (let i = 1; i < result.length; i++) {
        const prev = new Date(result[i - 1]!.createdAt).getTime();
        const curr = new Date(result[i]!.createdAt).getTime();
        expect(curr).toBeLessThanOrEqual(prev);
      }
    });

    test("ascending by attempts", async () => {
      const result = await findOtpCodes({
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { attempts: "asc" },
      });

      expect(result).toHaveLength(2);
      expect(result[0]!.attempts).toBe(0);
      expect(result[1]!.attempts).toBe(3);
    });

    test("descending by attempts", async () => {
      const result = await findOtpCodes({
        where: { or: [{ id: otpA.id }, { id: otpB.id }] },
        orderBy: { attempts: "desc" },
      });

      expect(result).toHaveLength(2);
      expect(result[0]!.attempts).toBe(3);
      expect(result[1]!.attempts).toBe(0);
    });
  });
});
