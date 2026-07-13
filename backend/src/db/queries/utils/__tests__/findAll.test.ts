/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent } from "../../../../tests/setup";
import { users } from "../../../schema";
import { findAll as untypedFindAll } from "../findAll";

// Test-only alias: forces `any` typing on findAll so rows expose plain
// dot-notation property access (the production signature returns an
// index-signature row type that TS forbids dotting into). The trade-off
// is losing compile-time `@ts-expect-error` checks inside the test bodies.
const findAll: any = untypedFindAll;

describe("db/queries/utils/findAll.ts", () => {
  let carlosSilvaAB: MockUser;
  let mariaSantosB: MockUser;
  let joaoOliveiraBCD: MockUser;
  let pedroOliveira: MockUser;
  let anaCostaAdmin: MockUser;

  beforeAll(async () => {
    // Last-name groups: Silva (1), Santos (1), Oliveira (2), Costa (1),
    // Ferreira (1) — 5 groups. joaoOliveiraBCD is the only null email.
    await agent.seed({
      users: [
        "carlosSilvaAB",
        "mariaSantosB",
        "joaoOliveiraBCD",
        "pedroOliveira",
        "anaCostaAdmin",
        "lucasFerreiraAdmin",
      ],
    });

    carlosSilvaAB = agent.getFixture({ user: "carlosSilvaAB" });
    mariaSantosB = agent.getFixture({ user: "mariaSantosB" });
    joaoOliveiraBCD = agent.getFixture({ user: "joaoOliveiraBCD" });
    pedroOliveira = agent.getFixture({ user: "pedroOliveira" });
    anaCostaAdmin = agent.getFixture({ user: "anaCostaAdmin" });
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
        email: carlosSilvaAB.email,
        firstName: carlosSilvaAB.firstName,
        lastName: carlosSilvaAB.lastName,
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
        attributes: ["id", "email", "firstName"],
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toEqual([
        {
          id: carlosSilvaAB.id,
          email: carlosSilvaAB.email,
          firstName: carlosSilvaAB.firstName,
        },
      ]);
    });

    test("returns aggregate with regular column", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        orderBy: { lastName: "asc" },
      });
      expect(results).toContainEqual({ lastName: "Oliveira", total: 2 });
      expect(results).toContainEqual({ lastName: "Silva", total: 1 });
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
        attributes: ["id", "email"],
        where: { id: joaoOliveiraBCD.id },
      });
      expect(results).toEqual([{ id: joaoOliveiraBCD.id, email: null }]);
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
          attributes: ["firstName"],
          groupBy: ["lastName"],
        }),
      ).rejects.toThrow();
    });

    test("does not throw if selecting any attributes when grouping by primary key", async () => {
      const results = await findAll({
        table: users,
        attributes: ["id", "email", "firstName"],
        groupBy: ["id"],
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(carlosSilvaAB.id);
    });

    test("does not throw if selecting grouped attribute", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        groupBy: ["lastName"],
      });
      expect(results).toHaveLength(5);
    });

    test("groups by multiple columns", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName", "firstName"],
        groupBy: ["lastName", "firstName"],
      });
      // Every (lastName, firstName) pair is distinct across the 6 users.
      expect(results).toHaveLength(6);
    });

    test("groups with where filter", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        groupBy: ["lastName"],
        where: { id: carlosSilvaAB.id },
      });
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ lastName: "Silva" });
    });

    test("groups with limit", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        groupBy: ["lastName"],
        limit: 1,
      });
      expect(results).toHaveLength(1);
    });

    test("groups with offset", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        groupBy: ["lastName"],
        orderBy: { lastName: "asc" },
        offset: 4,
      });
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ lastName: "Silva" });
    });

    test("groups with descending order", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        orderBy: { total: "desc" },
      });
      expect(results[0]!.total).toBeGreaterThanOrEqual(results[1]!.total);
    });

    describe("grouping with aggregates", () => {
      test("counts all rows grouped by some column", async () => {
        const results = await findAll({
          table: users,
          attributes: ["lastName"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["lastName"],
        });
        expect(results).toContainEqual({ lastName: "Oliveira", total: 2 });
        expect(results).toContainEqual({ lastName: "Costa", total: 1 });
      });

      test("counts with where filter", async () => {
        const results = await findAll({
          table: users,
          attributes: ["lastName"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["lastName"],
          where: { lastName: "Oliveira" },
        });
        expect(results).toEqual([{ lastName: "Oliveira", total: 2 }]);
      });

      test("counts with limit", async () => {
        const results = await findAll({
          table: users,
          attributes: ["lastName"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["lastName"],
          orderBy: { total: "desc" },
          limit: 1,
        });
        expect(results).toHaveLength(1);
        expect(results[0]!.total).toBe(2);
      });

      test("counts with offset", async () => {
        const results = await findAll({
          table: users,
          attributes: ["lastName"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["lastName"],
          orderBy: { total: "desc" },
          offset: 1,
        });
        // Skips the Oliveira group (2); the 4 remaining groups all have 1.
        expect(results).toHaveLength(4);
        expect(results.every((r: any) => r.total === 1)).toBe(true);
      });

      test("counts with descending order", async () => {
        const results = await findAll({
          table: users,
          attributes: ["lastName"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["lastName"],
          orderBy: { total: "desc" },
        });
        for (let i = 1; i < results.length; i++) {
          expect(results[i]!.total).toBeLessThanOrEqual(results[i - 1]!.total);
        }
      });

      test("uses multiple aggregates with different aliases", async () => {
        const results = await findAll({
          table: users,
          attributes: ["lastName"],
          aggregates: [
            { fn: "count", column: "*", as: "total" },
            { fn: "countDistinct", column: "email", as: "distinct" },
          ],
          groupBy: ["lastName"],
        });
        const oliveira = results.find((r: any) => r.lastName === "Oliveira");
        // 2 Oliveiras, but joaoOliveiraBCD's null email is not counted.
        expect(oliveira!.total).toBe(2);
        expect(oliveira!.distinct).toBe(1);
      });

      test("computes countDistinct over the whole table without groupBy", async () => {
        const results = await findAll({
          table: users,
          attributes: [],
          aggregates: [
            { fn: "countDistinct", column: "email", as: "uniqueEmails" },
            { fn: "countDistinct", column: "lastName", as: "uniqueLastNames" },
          ],
        });
        // 5 non-null distinct emails and 5 distinct last names.
        expect(results).toEqual([{ uniqueEmails: 5, uniqueLastNames: 5 }]);
      });

      test("returns empty result for grouped aggregate when no rows match", async () => {
        const results = await findAll({
          table: users,
          attributes: ["lastName"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          groupBy: ["lastName"],
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
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { total: { value: 1, operator: "gt" } },
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.lastName).toBe("Oliveira");
    });

    test("filters groups by aggregate with eq", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { total: { value: 2, operator: "eq" } },
      });
      expect(results).toEqual([{ lastName: "Oliveira", total: 2 }]);
    });

    test("filters groups by aggregate with gte", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { total: { value: 1, operator: "gte" } },
      });
      expect(results).toHaveLength(5);
    });

    test("filters groups by aggregate with lt", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { total: { value: 2, operator: "lt" } },
      });
      expect(results).toHaveLength(4);
      expect(results.every((r: any) => r.total === 1)).toBe(true);
    });

    test("filters groups by aggregate with lte", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { total: { value: 1, operator: "lte" } },
      });
      expect(results).toHaveLength(4);
    });

    test("filters groups by aggregate with ne", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { total: { value: 2, operator: "ne" } },
      });
      expect(results).toHaveLength(4);
      expect(results.every((r: any) => r.total !== 2)).toBe(true);
    });

    test("filters by grouped entity column", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { lastName: { value: "Oliveira", operator: "eq" } },
      });
      expect(results).toEqual([{ lastName: "Oliveira", total: 2 }]);
    });

    test("combines having with where", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        where: { firstName: { value: "Joao", operator: "ne" } },
        having: { total: { value: 2, operator: "lt" } },
      });
      // Excluding Joao shrinks the Oliveira group to 1, so all 5 groups pass.
      expect(results).toHaveLength(5);
      expect(results).toContainEqual({ lastName: "Oliveira", total: 1 });
    });

    test("returns empty when no groups match", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
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

    test("filters groups by grouped entity column with 'in' operator", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: {
          lastName: {
            value: ["Oliveira", "Silva"],
            operator: "in",
          },
        },
      });
      expect(results).toHaveLength(2);
      expect(
        results.every((r: any) => ["Oliveira", "Silva"].includes(r.lastName)),
      ).toBe(true);
    });
  });

  describe("filtering", () => {
    test("filters by null columns", async () => {
      const results = await findAll({
        table: users,
        attributes: ["id", "email"],
        where: { email: null },
      });
      expect(results).toEqual([{ id: joaoOliveiraBCD.id, email: null }]);
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

    test("filters by string column", async () => {
      const results = await findAll({
        table: users,
        where: { lastName: "Oliveira" },
      });
      expect(results).toHaveLength(2);
    });

    test("filters by string column with explicit filter", async () => {
      const results = await findAll({
        table: users,
        where: {
          lastName: { value: "Oliveira", operator: "ne" },
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
            and: [{ lastName: "Oliveira" }, { id: joaoOliveiraBCD.id }],
          },
        });
        expect(results).toHaveLength(1);
      });

      test("filters with 'or' at root level", async () => {
        const results = await findAll({
          table: users,
          where: {
            or: [{ lastName: "Oliveira" }, { id: carlosSilvaAB.id }],
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
                and: [{ lastName: "Costa" }, { id: anaCostaAdmin.id }],
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
              { lastName: "Oliveira" },
              {
                or: [{ id: joaoOliveiraBCD.id }, { id: pedroOliveira.id }],
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
              { lastName: "Oliveira" },
              {
                or: [
                  { email: null },
                  {
                    and: [{ id: pedroOliveira.id }],
                  },
                ],
              },
            ],
          },
        });
        // Joao matches via null email, Pedro via id.
        expect(results).toHaveLength(2);
      });

      test("filters with explicit operators inside logical operators", async () => {
        const results = await findAll({
          table: users,
          where: {
            and: [
              { lastName: { value: "Oliveira", operator: "eq" } },
              { id: { value: joaoOliveiraBCD.id, operator: "ne" } },
            ],
          },
        });
        expect(results).toHaveLength(1);
        expect(results[0]!.id).toBe(pedroOliveira.id);
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
          where: { not: { lastName: "Oliveira" } },
        });
        expect(results).toHaveLength(4);
        expect(results.every((r: any) => r.lastName !== "Oliveira")).toBe(true);
      });

      test("filters with 'not' negating multiple column filters", async () => {
        const results = await findAll({
          table: users,
          where: {
            not: {
              lastName: "Oliveira",
              id: joaoOliveiraBCD.id,
            },
          },
        });
        // NOT (lastName "Oliveira" AND joao) — keeps everything except joao.
        expect(results).toHaveLength(5);
      });

      test("filters with 'not' inside 'and'", async () => {
        const results = await findAll({
          table: users,
          where: {
            and: [
              { lastName: "Oliveira" },
              { not: { id: joaoOliveiraBCD.id } },
            ],
          },
        });
        expect(results).toHaveLength(1);
        expect(results[0]!.id).toBe(pedroOliveira.id);
      });

      test("filters with 'not' inside 'or'", async () => {
        const results = await findAll({
          table: users,
          where: {
            or: [{ email: null }, { not: { lastName: "Oliveira" } }],
          },
        });
        // Joao (null email) ∪ the 4 non-Oliveiras.
        expect(results).toHaveLength(5);
      });

      test("filters with 'not' wrapping 'or'", async () => {
        const results = await findAll({
          table: users,
          where: {
            not: {
              or: [{ lastName: "Oliveira" }, { id: carlosSilvaAB.id }],
            },
          },
        });
        expect(results).toHaveLength(3);
        expect(
          results.every(
            (r: any) =>
              r.lastName !== "Oliveira" && r.id !== carlosSilvaAB.id,
          ),
        ).toBe(true);
      });

      test("filters with nested 'not' inside 'not'", async () => {
        const results = await findAll({
          table: users,
          where: { not: { not: { lastName: "Oliveira" } } },
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

      test("filters by string column with 'in' operator", async () => {
        const results = await findAll({
          table: users,
          where: {
            lastName: {
              value: ["Oliveira"],
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
            lastName: "Oliveira",
            id: {
              value: [joaoOliveiraBCD.id, carlosSilvaAB.id],
              operator: "in",
            },
          },
        });
        expect(results).toHaveLength(1);
        expect(results[0]!.id).toBe(joaoOliveiraBCD.id);
      });

      test("works with 'in' operator inside logical 'and'", async () => {
        const results = await findAll({
          table: users,
          where: {
            and: [
              { lastName: "Oliveira" },
              {
                id: {
                  value: [pedroOliveira.id],
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
              { id: carlosSilvaAB.id },
              {
                lastName: {
                  value: ["Oliveira"],
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
    test("orders by column ascending", async () => {
      const results = await findAll({
        table: users,
        attributes: ["firstName"],
        orderBy: { firstName: "asc" },
      });
      const names = results.map((r: any) => r.firstName);
      expect(names).toEqual([...names].sort());
    });

    test("orders by column descending", async () => {
      const results = await findAll({
        table: users,
        attributes: ["firstName"],
        orderBy: { firstName: "desc" },
      });
      const names = results.map((r: any) => r.firstName);
      expect(names).toEqual([...names].sort().reverse());
    });

    test("orders by aggregate ascending", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        orderBy: { total: "asc" },
      });
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.total).toBeGreaterThanOrEqual(results[i - 1]!.total);
      }
    });

    test("orders by aggregate descending", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        orderBy: { total: "desc" },
      });
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.total).toBeLessThanOrEqual(results[i - 1]!.total);
      }
    });

    test("orders by aggregate with limit", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        orderBy: { total: "desc" },
        limit: 1,
      });
      expect(results).toEqual([{ lastName: "Oliveira", total: 2 }]);
    });

    test("orders by aggregate combined with regular column", async () => {
      const results = await findAll({
        table: users,
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        orderBy: { total: "desc", lastName: "asc" },
      });
      expect(results[0]).toEqual({ lastName: "Oliveira", total: 2 });
      expect(results[1]).toEqual({ lastName: "Costa", total: 1 });
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
        where: { lastName: "Oliveira" },
      });
      expect(result).toEqual([{ count: 2 }]);
    });

    test("returns grouped counts with groupBy", async () => {
      const result = await findAll({
        table: users,
        count: true,
        groupBy: ["lastName"],
      });
      expect(Array.isArray(result)).toBe(true);
      const groups = result as Array<{ lastName: string; count: number }>;
      expect(groups).toHaveLength(5);
      expect(groups).toContainEqual({ lastName: "Oliveira", count: 2 });
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
        groupBy: ["lastName"],
        having: { count: { value: 1, operator: "gt" } },
      });
      const groups = result as Array<{ count: number }>;
      expect(groups).toHaveLength(1);
      expect(groups[0]!.count).toBe(2);
    });

    test("ignores limit with count: true", async () => {
      // The production signature forbids this combination at the type level;
      // at runtime the extra option is silently ignored.
      const result = await findAll({
        table: users,
        count: true,
        limit: 5,
      });
      expect(result).toEqual([{ count: 6 }]);
    });

    test("ignores offset with count: true", async () => {
      const result = await findAll({
        table: users,
        count: true,
        offset: 1,
      });
      expect(result).toEqual([{ count: 6 }]);
    });

    test("ignores orderBy with count: true", async () => {
      const result = await findAll({
        table: users,
        count: true,
        orderBy: { id: "asc" },
      });
      expect(result).toEqual([{ count: 6 }]);
    });

    test("ignores attributes with count: true", async () => {
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
          { fn: "countDistinct", column: "email", as: "uniqueEmails" },
        ],
        groupBy: ["lastName"],
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(5);
    });
  });
});
