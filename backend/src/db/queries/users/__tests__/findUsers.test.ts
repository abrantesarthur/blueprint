import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent } from "../../../../tests/setup";
import { findUsers } from "..";

describe("db/queries/users/findUsers.ts", () => {
  let carlosSilvaAB: MockUser;
  let mariaSantosB: MockUser;
  let joaoOliveiraBCD: MockUser;
  let anaCostaAdmin: MockUser;
  let lucasFerreiraAdmin: MockUser;

  beforeAll(async () => {
    await agent.seed({
      users: [
        "carlosSilvaAB",
        "mariaSantosB",
        "joaoOliveiraBCD",
        "anaCostaAdmin",
        "lucasFerreiraAdmin",
      ],
    });

    carlosSilvaAB = agent.getFixture({ user: "carlosSilvaAB" });
    mariaSantosB = agent.getFixture({ user: "mariaSantosB" });
    joaoOliveiraBCD = agent.getFixture({ user: "joaoOliveiraBCD" });
    anaCostaAdmin = agent.getFixture({ user: "anaCostaAdmin" });
    lucasFerreiraAdmin = agent.getFixture({ user: "lucasFerreiraAdmin" });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("attributes", () => {
    test("returns no columns when empty attributes", async () => {
      const results = await findUsers({
        attributes: [],
      });

      expect(results).toEqual([{}, {}, {}, {}, {}]);
    });

    test("returns a single column with orderBy", async () => {
      const results = await findUsers({
        attributes: ["id"],
        orderBy: { id: "asc" },
      });

      expect(results).toEqual([
        { id: carlosSilvaAB.id },
        { id: mariaSantosB.id },
        { id: anaCostaAdmin.id },
        { id: lucasFerreiraAdmin.id },
        { id: joaoOliveiraBCD.id },
      ]);
    });

    test("returns multiple columns with orderBy", async () => {
      const results = await findUsers({
        attributes: ["id", "email", "role"],
        orderBy: { id: "asc" },
      });

      expect(results).toEqual([
        {
          id: carlosSilvaAB.id,
          email: carlosSilvaAB.email,
          role: "user",
        },
        {
          id: mariaSantosB.id,
          email: mariaSantosB.email,
          role: "user",
        },
        { id: anaCostaAdmin.id, email: anaCostaAdmin.email, role: "admin" },
        {
          id: lucasFerreiraAdmin.id,
          email: lucasFerreiraAdmin.email,
          role: "admin",
        },
        {
          id: joaoOliveiraBCD.id,
          email: joaoOliveiraBCD.email,
          role: "user",
        },
      ]);
    });

    test("returns aggregate with regular column", async () => {
      const results = await findUsers({
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        orderBy: { role: "asc" },
      });

      expect(results).toEqual([
        { role: "user", total: 3 },
        { role: "admin", total: 2 },
      ]);
    });

    test("returns attributes with where filter", async () => {
      const results = await findUsers({
        attributes: ["id", "email"],
        where: { role: "user" },
        orderBy: { id: "asc" },
      });

      expect(results).toEqual([
        { id: carlosSilvaAB.id, email: carlosSilvaAB.email },
        { id: mariaSantosB.id, email: mariaSantosB.email },
        { id: joaoOliveiraBCD.id, email: joaoOliveiraBCD.email },
      ]);
    });

    test("returns attributes with limit and offset", async () => {
      const results = await findUsers({
        attributes: ["id"],
        orderBy: { id: "asc" },
        limit: 2,
        offset: 1,
      });

      expect(results).toEqual([
        { id: mariaSantosB.id },
        { id: anaCostaAdmin.id },
      ]);
    });

    test("returns nullable columns as null", async () => {
      const results = await findUsers({
        attributes: ["id", "otpRequestedAt"],
        where: { id: carlosSilvaAB.id },
      });

      expect(results).toEqual([{ id: carlosSilvaAB.id, otpRequestedAt: null }]);
    });

    test("returns timestamp columns", async () => {
      const results = await findUsers({
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
    test("throws if specifying non-grouped attribute when grouping by non-PK column", async () => {
      await expect(
        findUsers({
          groupBy: ["role"],
          attributes: ["role", "email"],
          orderBy: { role: "asc" },
        }),
      ).rejects.toThrow(Error);
    });

    test("does not throw when selecting any attributes when grouping by primary key", async () => {
      const results = await findUsers({
        groupBy: ["id"],
        attributes: ["id", "email"],
        aggregates: [{ fn: "count", column: "*", as: "count" }],
        orderBy: { id: "asc" },
      });

      const sorted = [...results].sort((a, b) => a.id.localeCompare(b.id));
      expect(results).toEqual(sorted);
      expect(results).toHaveLength(5);
      expect(results.every((r) => r.count === 1)).toBe(true);
    });

    test("groups by role", async () => {
      const results = await findUsers({
        groupBy: ["role"],
        attributes: ["role"],
        orderBy: { role: "asc" },
      });

      expect(results).toEqual([{ role: "user" }, { role: "admin" }]);
    });

    test("groups by phoneVerified", async () => {
      const results = await findUsers({
        groupBy: ["phoneVerified"],
        attributes: ["phoneVerified"],
      });

      expect(results).toEqual([{ phoneVerified: false }]);
    });

    test("groups by multiple columns", async () => {
      const results = await findUsers({
        groupBy: ["role", "phoneVerified"],
        attributes: ["role", "phoneVerified"],
        orderBy: { role: "asc" },
      });

      expect(results).toEqual([
        { role: "user", phoneVerified: false },
        { role: "admin", phoneVerified: false },
      ]);
    });

    test("groups with where filter", async () => {
      const results = await findUsers({
        groupBy: ["role"],
        attributes: ["role"],
        where: { role: "user" },
      });

      expect(results).toEqual([{ role: "user" }]);
    });

    test("groups with limit", async () => {
      const results = await findUsers({
        groupBy: ["role"],
        attributes: ["role"],
        orderBy: { role: "asc" },
        limit: 1,
      });

      expect(results).toEqual([{ role: "user" }]);
    });

    test("groups with offset", async () => {
      const results = await findUsers({
        groupBy: ["role"],
        attributes: ["role"],
        orderBy: { role: "asc" },
        offset: 1,
      });

      expect(results).toEqual([{ role: "admin" }]);
    });

    test("groups with descending order", async () => {
      const results = await findUsers({
        groupBy: ["role"],
        attributes: ["role"],
        orderBy: { role: "desc" },
      });

      expect(results).toEqual([{ role: "admin" }, { role: "user" }]);
    });

    describe("grouping with aggregates", () => {
      test("count grouped by role", async () => {
        const results = await findUsers({
          groupBy: ["role"],
          attributes: ["role"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          orderBy: { role: "asc" },
        });

        expect(results).toEqual([
          { role: "user", total: 3 },
          { role: "admin", total: 2 },
        ]);
      });

      test("count with where filter", async () => {
        const results = await findUsers({
          groupBy: ["role"],
          attributes: ["role"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          where: { role: "user" },
          orderBy: { role: "asc" },
        });

        expect(results).toEqual([{ role: "user", total: 3 }]);
      });

      test("count with limit", async () => {
        const results = await findUsers({
          groupBy: ["role"],
          attributes: ["role"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          orderBy: { role: "asc" },
          limit: 1,
        });

        expect(results).toEqual([{ role: "user", total: 3 }]);
      });

      test("count with offset", async () => {
        const results = await findUsers({
          groupBy: ["role"],
          attributes: ["role"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          orderBy: { role: "asc" },
          offset: 1,
        });

        expect(results).toEqual([{ role: "admin", total: 2 }]);
      });

      test("count with descending order", async () => {
        const results = await findUsers({
          groupBy: ["role"],
          attributes: ["role"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          orderBy: { role: "desc" },
        });

        expect(results).toEqual([
          { role: "admin", total: 2 },
          { role: "user", total: 3 },
        ]);
      });

      test("count on specific column", async () => {
        const results = await findUsers({
          groupBy: ["role"],
          attributes: ["role"],
          aggregates: [{ fn: "count", column: "id", as: "idCount" }],
          orderBy: { role: "asc" },
        });

        expect(results).toEqual([
          { role: "user", idCount: 3 },
          { role: "admin", idCount: 2 },
        ]);
      });

      test("multiple aggregates with different aliases", async () => {
        const results = await findUsers({
          groupBy: ["role"],
          attributes: ["role"],
          aggregates: [
            { fn: "count", column: "*", as: "total" },
            { fn: "count", column: "id", as: "idCount" },
          ],
          orderBy: { role: "asc" },
        });

        expect(results).toEqual([
          { role: "user", total: 3, idCount: 3 },
          { role: "admin", total: 2, idCount: 2 },
        ]);
      });
    });
  });

  describe("having", () => {
    test("filters groups by aggregate with gt", async () => {
      const results = await findUsers({
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { operator: "gt", value: 2 } },
        orderBy: { role: "asc" },
      });

      expect(results).toEqual([{ role: "user", total: 3 }]);
    });

    test("filters groups by aggregate with eq", async () => {
      const results = await findUsers({
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { operator: "eq", value: 2 } },
      });

      expect(results).toEqual([{ role: "admin", total: 2 }]);
    });

    test("filters groups by aggregate with gte", async () => {
      const results = await findUsers({
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { operator: "gte", value: 2 } },
        orderBy: { role: "asc" },
      });

      expect(results).toEqual([
        { role: "user", total: 3 },
        { role: "admin", total: 2 },
      ]);
    });

    test("filters groups by aggregate with lt", async () => {
      const results = await findUsers({
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { operator: "lt", value: 3 } },
      });

      expect(results).toEqual([{ role: "admin", total: 2 }]);
    });

    test("filters groups by aggregate with lte", async () => {
      const results = await findUsers({
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { operator: "lte", value: 2 } },
      });

      expect(results).toEqual([{ role: "admin", total: 2 }]);
    });

    test("filters groups by aggregate with ne", async () => {
      const results = await findUsers({
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { operator: "ne", value: 3 } },
        orderBy: { role: "asc" },
      });

      expect(results).toEqual([{ role: "admin", total: 2 }]);
    });

    test("filters by grouped entity column", async () => {
      const results = await findUsers({
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { role: { operator: "eq", value: "user" } },
      });

      expect(results).toEqual([{ role: "user", total: 3 }]);
    });

    test("combines aggregate and column having", async () => {
      const results = await findUsers({
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: {
          total: { operator: "gte", value: 1 },
          role: { operator: "eq", value: "user" },
        },
      });

      expect(results).toEqual([{ role: "user", total: 3 }]);
    });

    test("combines having with where", async () => {
      // where narrows to non-admin users (3 regular users)
      // having total > 2 keeps only the "user" group
      const results = await findUsers({
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        where: { not: { role: "admin" } },
        having: { total: { operator: "gt", value: 2 } },
      });

      expect(results).toEqual([{ role: "user", total: 3 }]);
    });

    test("returns empty when no groups match", async () => {
      const results = await findUsers({
        attributes: ["role"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["role"],
        having: { total: { operator: "gt", value: 100 } },
      });

      expect(results).toEqual([]);
    });

    test("works without groupBy", async () => {
      const results = await findUsers({
        attributes: [],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        having: { total: { operator: "gt", value: 3 } },
      });

      expect(results).toEqual([{ total: 5 }]);
    });
  });

  describe("filtering", () => {
    test("filters by id", async () => {
      const result = await findUsers({
        where: { id: carlosSilvaAB.id },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: carlosSilvaAB.id });
    });

    test("filters by id with explicit filter", async () => {
      const result = await findUsers({
        where: { id: { operator: "ne", value: carlosSilvaAB.id } },
      });

      expect(result).toHaveLength(4);
      expect(result.filter((r) => r.id === carlosSilvaAB.id)).toBeEmpty();
    });

    test("filters by id with multiple explicit filters", async () => {
      const result = await findUsers({
        where: {
          id: [
            { operator: "ne", value: carlosSilvaAB.id },
            { operator: "ne", value: mariaSantosB.id },
            { operator: "ne", value: joaoOliveiraBCD.id },
            { operator: "ne", value: anaCostaAdmin.id },
          ],
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(lucasFerreiraAdmin.id);
    });

    test("filters by email", async () => {
      const result = await findUsers({
        where: { email: carlosSilvaAB.email },
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.email).toBe(carlosSilvaAB.email);
    });

    test("filters by role", async () => {
      const result = await findUsers({
        where: { role: "user" },
      });

      expect(result).toHaveLength(3);
      expect(result.every((r) => r.role === "user")).toBe(true);
    });

    test("filters by role with explicit filter", async () => {
      const result = await findUsers({
        where: { role: { operator: "eq", value: "admin" } },
      });

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.role === "admin")).toBe(true);
    });

    test("returns empty for non-existent ID", async () => {
      const result = await findUsers({
        where: { id: "00000000-0000-0000-0000-000000000000" },
      });

      expect(result).toEqual([]);
    });

    test("returns all when no filters", async () => {
      const result = await findUsers({});

      expect(result).toHaveLength(5);
    });

    describe("logical operators", () => {
      test("filters with 'and' at root level", async () => {
        const result = await findUsers({
          where: {
            and: [{ role: "user" }, { id: carlosSilvaAB.id }],
          },
        });

        expect(result).toHaveLength(1);
        expect(result[0]!.id).toBe(carlosSilvaAB.id);
      });

      test("filters with 'or' at root level", async () => {
        const result = await findUsers({
          where: {
            or: [{ id: carlosSilvaAB.id }, { role: "admin" }],
          },
        });

        // carlosSilvaAB + anaCostaAdmin + lucasFerreiraAdmin
        expect(result).toHaveLength(3);
        expect(
          result.every((r) => r.id === carlosSilvaAB.id || r.role === "admin"),
        ).toBe(true);
      });

      test("filters with nested 'and' inside 'or'", async () => {
        // Find users that are either:
        // - id = carlosSilvaAB OR
        // - (admin AND anaCostaAdmin)
        const result = await findUsers({
          where: {
            or: [
              { id: carlosSilvaAB.id },
              {
                and: [{ role: "admin" }, { id: anaCostaAdmin.id }],
              },
            ],
          },
        });

        // carlosSilvaAB + anaCostaAdmin
        expect(result).toHaveLength(2);
        expect(
          result.every(
            (r) =>
              r.id === carlosSilvaAB.id ||
              (r.role === "admin" && r.id === anaCostaAdmin.id),
          ),
        ).toBe(true);
      });

      test("filters with nested 'or' inside 'and'", async () => {
        // Find users that are:
        // - role "user" AND
        // - (id = carlosSilvaAB OR id = mariaSantosB)
        const result = await findUsers({
          where: {
            and: [
              { role: "user" },
              {
                or: [{ id: carlosSilvaAB.id }, { id: mariaSantosB.id }],
              },
            ],
          },
        });

        expect(result).toHaveLength(2);
        expect(
          result.every(
            (r) =>
              r.role === "user" &&
              (r.id === carlosSilvaAB.id || r.id === mariaSantosB.id),
          ),
        ).toBe(true);
      });

      test("filters with deeply nested logical operators (3 levels)", async () => {
        // Find users that are:
        // - admin OR
        // - (role "user" AND (id = carlosSilvaAB OR id = joaoOliveiraBCD))
        const result = await findUsers({
          where: {
            or: [
              { role: "admin" },
              {
                and: [
                  { role: "user" },
                  {
                    or: [{ id: carlosSilvaAB.id }, { id: joaoOliveiraBCD.id }],
                  },
                ],
              },
            ],
          },
        });

        // anaCostaAdmin, lucasFerreiraAdmin, carlosSilvaAB, joaoOliveiraBCD
        expect(result).toHaveLength(4);
        expect(
          result.every(
            (r) =>
              r.role === "admin" ||
              (r.role === "user" &&
                (r.id === carlosSilvaAB.id || r.id === joaoOliveiraBCD.id)),
          ),
        ).toBe(true);
      });

      test("filters with explicit operators inside logical operators", async () => {
        // Find users where:
        // - role = user AND id != carlosSilvaAB
        const result = await findUsers({
          where: {
            and: [
              { role: { operator: "eq", value: "user" } },
              { id: { operator: "ne", value: carlosSilvaAB.id } },
            ],
          },
        });

        // mariaSantosB, joaoOliveiraBCD
        expect(result).toHaveLength(2);
        expect(
          result.every(
            (r) => r.role === "user" && r.id !== carlosSilvaAB.id,
          ),
        ).toBe(true);
      });

      test("filters with 'or' combining column filters", async () => {
        // Find users where:
        // - (role "user" AND id = carlosSilvaAB) OR role = admin
        const result = await findUsers({
          where: {
            or: [
              {
                and: [{ role: "user" }, { id: carlosSilvaAB.id }],
              },
              { role: "admin" },
            ],
          },
        });

        // carlosSilvaAB + anaCostaAdmin + lucasFerreiraAdmin
        expect(result).toHaveLength(3);
        expect(
          result.every(
            (r) =>
              (r.role === "user" && r.id === carlosSilvaAB.id) ||
              r.role === "admin",
          ),
        ).toBe(true);
      });

      test("returns all when 'and' has empty array", async () => {
        const result = await findUsers({
          where: { and: [] },
        });

        expect(result).toHaveLength(5);
      });

      test("returns all when 'or' has empty array", async () => {
        const result = await findUsers({
          where: { or: [] },
        });

        expect(result).toHaveLength(5);
      });

      test("filters with 'not' at root level", async () => {
        // Find users whose role is NOT "user"
        const result = await findUsers({
          where: { not: { role: "user" } },
        });

        // 2 admins
        expect(result).toHaveLength(2);
        expect(result.every((r) => r.role !== "user")).toBe(true);
      });

      test("filters with 'not' negating multiple column filters", async () => {
        // Find users that are NOT (role "user" AND carlosSilvaAB)
        const result = await findUsers({
          where: {
            not: {
              role: "user",
              id: carlosSilvaAB.id,
            },
          },
        });

        // All except carlosSilvaAB
        expect(result).toHaveLength(4);
        expect(
          result.every(
            (r) => !(r.role === "user" && r.id === carlosSilvaAB.id),
          ),
        ).toBe(true);
      });

      test("filters with 'not' inside 'and'", async () => {
        // Find users with role "user" AND NOT carlosSilvaAB
        const result = await findUsers({
          where: {
            and: [{ role: "user" }, { not: { id: carlosSilvaAB.id } }],
          },
        });

        // mariaSantosB, joaoOliveiraBCD
        expect(result).toHaveLength(2);
        expect(
          result.every(
            (r) => r.role === "user" && r.id !== carlosSilvaAB.id,
          ),
        ).toBe(true);
      });

      test("filters with 'not' inside 'or'", async () => {
        // Find users that are admin OR NOT role "user"
        const result = await findUsers({
          where: {
            or: [{ role: "admin" }, { not: { role: "user" } }],
          },
        });

        // 2 admins (the only non-"user" roles)
        expect(result).toHaveLength(2);
        expect(
          result.every((r) => r.role === "admin" || r.role !== "user"),
        ).toBe(true);
      });

      test("filters with 'not' wrapping 'or'", async () => {
        // Find users that are NOT (admin OR id = carlosSilvaAB)
        const result = await findUsers({
          where: {
            not: {
              or: [{ role: "admin" }, { id: carlosSilvaAB.id }],
            },
          },
        });

        // mariaSantosB, joaoOliveiraBCD
        expect(result).toHaveLength(2);
        expect(
          result.every((r) => r.role !== "admin" && r.id !== carlosSilvaAB.id),
        ).toBe(true);
      });

      test("filters with nested 'not' inside 'not'", async () => {
        // Find users that are NOT (NOT "user") = "user"
        const result = await findUsers({
          where: {
            not: {
              not: { role: "user" },
            },
          },
        });

        // Double negation: role "user" records
        expect(result).toHaveLength(3);
        expect(result.every((r) => r.role === "user")).toBe(true);
      });
    });
  });

  describe("pagination", () => {
    test("respects limit", async () => {
      const result = await findUsers({
        orderBy: { createdAt: "asc" },
        limit: 2,
      });

      expect(result).toHaveLength(2);
    });

    test("respects offset", async () => {
      const allResults = await findUsers({
        orderBy: { createdAt: "asc" },
      });

      const result = await findUsers({
        orderBy: { createdAt: "asc" },
        offset: 2,
      });

      expect(result).toHaveLength(3);
      expect(result[0]!.id).toBe(allResults[2]!.id);
    });
  });

  describe("ordering", () => {
    test("ascending by createdAt", async () => {
      const result = await findUsers({
        orderBy: { createdAt: "asc" },
      });

      expect(result).toHaveLength(5);

      for (let i = 1; i < result.length; i++) {
        const prev = new Date(result[i - 1]!.createdAt).getTime();
        const curr = new Date(result[i]!.createdAt).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    test("descending by createdAt", async () => {
      const result = await findUsers({
        orderBy: { createdAt: "desc" },
      });

      expect(result).toHaveLength(5);

      for (let i = 1; i < result.length; i++) {
        const prev = new Date(result[i - 1]!.createdAt).getTime();
        const curr = new Date(result[i]!.createdAt).getTime();
        expect(curr).toBeLessThanOrEqual(prev);
      }
    });
  });
});
