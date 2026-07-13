import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent } from "../../../../tests/setup";
import { findUsers } from "..";

describe("db/queries/users/findUsers.ts", () => {
  let carlosSilvaAB: MockUser;
  let mariaSantosB: MockUser;
  let joaoOliveiraBCD: MockUser;
  let pedroOliveira: MockUser;
  let anaCostaAdmin: MockUser;
  let lucasFerreiraAdmin: MockUser;

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
    });

    carlosSilvaAB = agent.getFixture({ user: "carlosSilvaAB" });
    mariaSantosB = agent.getFixture({ user: "mariaSantosB" });
    joaoOliveiraBCD = agent.getFixture({ user: "joaoOliveiraBCD" });
    pedroOliveira = agent.getFixture({ user: "pedroOliveira" });
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

      expect(results).toEqual([{}, {}, {}, {}, {}, {}]);
    });

    test("returns a single column with orderBy", async () => {
      const results = await findUsers({
        attributes: ["id"],
        orderBy: { id: "asc" },
      });

      expect(results).toEqual([
        { id: carlosSilvaAB.id },
        { id: mariaSantosB.id },
        { id: pedroOliveira.id },
        { id: anaCostaAdmin.id },
        { id: lucasFerreiraAdmin.id },
        { id: joaoOliveiraBCD.id },
      ]);
    });

    test("returns multiple columns with orderBy", async () => {
      const results = await findUsers({
        attributes: ["id", "email", "lastName"],
        orderBy: { id: "asc" },
      });

      expect(results).toEqual([
        {
          id: carlosSilvaAB.id,
          email: carlosSilvaAB.email,
          lastName: carlosSilvaAB.lastName,
        },
        {
          id: mariaSantosB.id,
          email: mariaSantosB.email,
          lastName: mariaSantosB.lastName,
        },
        {
          id: pedroOliveira.id,
          email: pedroOliveira.email,
          lastName: pedroOliveira.lastName,
        },
        {
          id: anaCostaAdmin.id,
          email: anaCostaAdmin.email,
          lastName: anaCostaAdmin.lastName,
        },
        {
          id: lucasFerreiraAdmin.id,
          email: lucasFerreiraAdmin.email,
          lastName: lucasFerreiraAdmin.lastName,
        },
        {
          id: joaoOliveiraBCD.id,
          email: joaoOliveiraBCD.email,
          lastName: joaoOliveiraBCD.lastName,
        },
      ]);
    });

    test("returns aggregate with regular column", async () => {
      const results = await findUsers({
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        orderBy: { lastName: "asc" },
      });

      expect(results).toEqual([
        { lastName: "Costa", total: 1 },
        { lastName: "Ferreira", total: 1 },
        { lastName: "Oliveira", total: 2 },
        { lastName: "Santos", total: 1 },
        { lastName: "Silva", total: 1 },
      ]);
    });

    test("returns attributes with where filter", async () => {
      const results = await findUsers({
        attributes: ["id", "email"],
        where: { lastName: "Oliveira" },
        orderBy: { id: "asc" },
      });

      expect(results).toEqual([
        { id: pedroOliveira.id, email: pedroOliveira.email },
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
        { id: pedroOliveira.id },
      ]);
    });

    test("returns nullable columns as null", async () => {
      const results = await findUsers({
        attributes: ["id", "email"],
        where: { id: joaoOliveiraBCD.id },
      });

      expect(results).toEqual([{ id: joaoOliveiraBCD.id, email: null }]);
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
          groupBy: ["lastName"],
          attributes: ["lastName", "email"],
          orderBy: { lastName: "asc" },
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
      expect(results).toHaveLength(6);
      expect(results.every((r) => r.count === 1)).toBe(true);
    });

    test("groups by lastName", async () => {
      const results = await findUsers({
        groupBy: ["lastName"],
        attributes: ["lastName"],
        orderBy: { lastName: "asc" },
      });

      expect(results).toEqual([
        { lastName: "Costa" },
        { lastName: "Ferreira" },
        { lastName: "Oliveira" },
        { lastName: "Santos" },
        { lastName: "Silva" },
      ]);
    });

    test("groups by firstName", async () => {
      const results = await findUsers({
        groupBy: ["firstName"],
        attributes: ["firstName"],
        orderBy: { firstName: "asc" },
      });

      expect(results).toEqual([
        { firstName: "Ana" },
        { firstName: "Carlos" },
        { firstName: "Joao" },
        { firstName: "Lucas" },
        { firstName: "Maria" },
        { firstName: "Pedro" },
      ]);
    });

    test("groups by multiple columns", async () => {
      const results = await findUsers({
        groupBy: ["lastName", "firstName"],
        attributes: ["lastName", "firstName"],
        orderBy: { firstName: "asc" },
      });

      expect(results).toEqual([
        { lastName: "Costa", firstName: "Ana" },
        { lastName: "Silva", firstName: "Carlos" },
        { lastName: "Oliveira", firstName: "Joao" },
        { lastName: "Ferreira", firstName: "Lucas" },
        { lastName: "Santos", firstName: "Maria" },
        { lastName: "Oliveira", firstName: "Pedro" },
      ]);
    });

    test("groups with where filter", async () => {
      const results = await findUsers({
        groupBy: ["lastName"],
        attributes: ["lastName"],
        where: { lastName: "Oliveira" },
      });

      expect(results).toEqual([{ lastName: "Oliveira" }]);
    });

    test("groups with limit", async () => {
      const results = await findUsers({
        groupBy: ["lastName"],
        attributes: ["lastName"],
        orderBy: { lastName: "asc" },
        limit: 1,
      });

      expect(results).toEqual([{ lastName: "Costa" }]);
    });

    test("groups with offset", async () => {
      const results = await findUsers({
        groupBy: ["lastName"],
        attributes: ["lastName"],
        orderBy: { lastName: "asc" },
        offset: 4,
      });

      expect(results).toEqual([{ lastName: "Silva" }]);
    });

    test("groups with descending order", async () => {
      const results = await findUsers({
        groupBy: ["lastName"],
        attributes: ["lastName"],
        orderBy: { lastName: "desc" },
      });

      expect(results).toEqual([
        { lastName: "Silva" },
        { lastName: "Santos" },
        { lastName: "Oliveira" },
        { lastName: "Ferreira" },
        { lastName: "Costa" },
      ]);
    });

    describe("grouping with aggregates", () => {
      test("count grouped by lastName", async () => {
        const results = await findUsers({
          groupBy: ["lastName"],
          attributes: ["lastName"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          orderBy: { lastName: "asc" },
        });

        expect(results).toEqual([
          { lastName: "Costa", total: 1 },
          { lastName: "Ferreira", total: 1 },
          { lastName: "Oliveira", total: 2 },
          { lastName: "Santos", total: 1 },
          { lastName: "Silva", total: 1 },
        ]);
      });

      test("count with where filter", async () => {
        const results = await findUsers({
          groupBy: ["lastName"],
          attributes: ["lastName"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          where: { lastName: "Oliveira" },
          orderBy: { lastName: "asc" },
        });

        expect(results).toEqual([{ lastName: "Oliveira", total: 2 }]);
      });

      test("count with limit", async () => {
        const results = await findUsers({
          groupBy: ["lastName"],
          attributes: ["lastName"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          orderBy: { lastName: "asc" },
          limit: 1,
        });

        expect(results).toEqual([{ lastName: "Costa", total: 1 }]);
      });

      test("count with offset", async () => {
        const results = await findUsers({
          groupBy: ["lastName"],
          attributes: ["lastName"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          orderBy: { lastName: "asc" },
          offset: 4,
        });

        expect(results).toEqual([{ lastName: "Silva", total: 1 }]);
      });

      test("count with descending order", async () => {
        const results = await findUsers({
          groupBy: ["lastName"],
          attributes: ["lastName"],
          aggregates: [{ fn: "count", column: "*", as: "total" }],
          orderBy: { lastName: "desc" },
        });

        expect(results).toEqual([
          { lastName: "Silva", total: 1 },
          { lastName: "Santos", total: 1 },
          { lastName: "Oliveira", total: 2 },
          { lastName: "Ferreira", total: 1 },
          { lastName: "Costa", total: 1 },
        ]);
      });

      test("count on specific column skips null values", async () => {
        const results = await findUsers({
          groupBy: ["lastName"],
          attributes: ["lastName"],
          aggregates: [{ fn: "count", column: "email", as: "emailCount" }],
          orderBy: { lastName: "asc" },
        });

        expect(results).toEqual([
          { lastName: "Costa", emailCount: 1 },
          { lastName: "Ferreira", emailCount: 1 },
          { lastName: "Oliveira", emailCount: 1 },
          { lastName: "Santos", emailCount: 1 },
          { lastName: "Silva", emailCount: 1 },
        ]);
      });

      test("multiple aggregates with different aliases", async () => {
        const results = await findUsers({
          groupBy: ["lastName"],
          attributes: ["lastName"],
          aggregates: [
            { fn: "count", column: "*", as: "total" },
            { fn: "count", column: "id", as: "idCount" },
          ],
          orderBy: { lastName: "asc" },
        });

        expect(results).toEqual([
          { lastName: "Costa", total: 1, idCount: 1 },
          { lastName: "Ferreira", total: 1, idCount: 1 },
          { lastName: "Oliveira", total: 2, idCount: 2 },
          { lastName: "Santos", total: 1, idCount: 1 },
          { lastName: "Silva", total: 1, idCount: 1 },
        ]);
      });
    });
  });

  describe("having", () => {
    test("filters groups by aggregate with gt", async () => {
      const results = await findUsers({
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { total: { operator: "gt", value: 1 } },
        orderBy: { lastName: "asc" },
      });

      expect(results).toEqual([{ lastName: "Oliveira", total: 2 }]);
    });

    test("filters groups by aggregate with eq", async () => {
      const results = await findUsers({
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { total: { operator: "eq", value: 2 } },
      });

      expect(results).toEqual([{ lastName: "Oliveira", total: 2 }]);
    });

    test("filters groups by aggregate with gte", async () => {
      const results = await findUsers({
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { total: { operator: "gte", value: 1 } },
        orderBy: { lastName: "asc" },
      });

      expect(results).toEqual([
        { lastName: "Costa", total: 1 },
        { lastName: "Ferreira", total: 1 },
        { lastName: "Oliveira", total: 2 },
        { lastName: "Santos", total: 1 },
        { lastName: "Silva", total: 1 },
      ]);
    });

    test("filters groups by aggregate with lt", async () => {
      const results = await findUsers({
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { total: { operator: "lt", value: 2 } },
        orderBy: { lastName: "asc" },
      });

      expect(results).toEqual([
        { lastName: "Costa", total: 1 },
        { lastName: "Ferreira", total: 1 },
        { lastName: "Santos", total: 1 },
        { lastName: "Silva", total: 1 },
      ]);
    });

    test("filters groups by aggregate with lte", async () => {
      const results = await findUsers({
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { total: { operator: "lte", value: 1 } },
        orderBy: { lastName: "asc" },
      });

      expect(results).toEqual([
        { lastName: "Costa", total: 1 },
        { lastName: "Ferreira", total: 1 },
        { lastName: "Santos", total: 1 },
        { lastName: "Silva", total: 1 },
      ]);
    });

    test("filters groups by aggregate with ne", async () => {
      const results = await findUsers({
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { total: { operator: "ne", value: 1 } },
        orderBy: { lastName: "asc" },
      });

      expect(results).toEqual([{ lastName: "Oliveira", total: 2 }]);
    });

    test("filters by grouped entity column", async () => {
      const results = await findUsers({
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: { lastName: { operator: "eq", value: "Oliveira" } },
      });

      expect(results).toEqual([{ lastName: "Oliveira", total: 2 }]);
    });

    test("combines aggregate and column having", async () => {
      const results = await findUsers({
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        having: {
          total: { operator: "gte", value: 1 },
          lastName: { operator: "eq", value: "Oliveira" },
        },
      });

      expect(results).toEqual([{ lastName: "Oliveira", total: 2 }]);
    });

    test("combines having with where", async () => {
      // where narrows out the Silva user; having keeps groups with 2+ members
      const results = await findUsers({
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
        where: { not: { lastName: "Silva" } },
        having: { total: { operator: "gt", value: 1 } },
      });

      expect(results).toEqual([{ lastName: "Oliveira", total: 2 }]);
    });

    test("returns empty when no groups match", async () => {
      const results = await findUsers({
        attributes: ["lastName"],
        aggregates: [{ fn: "count", column: "*", as: "total" }],
        groupBy: ["lastName"],
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

      expect(results).toEqual([{ total: 6 }]);
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

      expect(result).toHaveLength(5);
      expect(result.filter((r) => r.id === carlosSilvaAB.id)).toBeEmpty();
    });

    test("filters by id with multiple explicit filters", async () => {
      const result = await findUsers({
        where: {
          id: [
            { operator: "ne", value: carlosSilvaAB.id },
            { operator: "ne", value: mariaSantosB.id },
            { operator: "ne", value: joaoOliveiraBCD.id },
            { operator: "ne", value: pedroOliveira.id },
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

    test("filters by null email", async () => {
      const result = await findUsers({
        where: { email: null },
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(joaoOliveiraBCD.id);
    });

    test("filters by lastName", async () => {
      const result = await findUsers({
        where: { lastName: "Oliveira" },
      });

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.lastName === "Oliveira")).toBe(true);
    });

    test("filters by lastName with explicit filter", async () => {
      const result = await findUsers({
        where: { lastName: { operator: "eq", value: "Oliveira" } },
      });

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.lastName === "Oliveira")).toBe(true);
    });

    test("returns empty for non-existent ID", async () => {
      const result = await findUsers({
        where: { id: "00000000-0000-0000-0000-000000000000" },
      });

      expect(result).toEqual([]);
    });

    test("returns all when no filters", async () => {
      const result = await findUsers({});

      expect(result).toHaveLength(6);
    });

    describe("logical operators", () => {
      test("filters with 'and' at root level", async () => {
        const result = await findUsers({
          where: {
            and: [{ lastName: "Silva" }, { id: carlosSilvaAB.id }],
          },
        });

        expect(result).toHaveLength(1);
        expect(result[0]!.id).toBe(carlosSilvaAB.id);
      });

      test("filters with 'or' at root level", async () => {
        const result = await findUsers({
          where: {
            or: [{ id: carlosSilvaAB.id }, { lastName: "Oliveira" }],
          },
        });

        // carlosSilvaAB + joaoOliveiraBCD + pedroOliveira
        expect(result).toHaveLength(3);
        expect(
          result.every(
            (r) => r.id === carlosSilvaAB.id || r.lastName === "Oliveira",
          ),
        ).toBe(true);
      });

      test("filters with nested 'and' inside 'or'", async () => {
        // Find users that are either:
        // - id = carlosSilvaAB OR
        // - (lastName "Oliveira" AND joaoOliveiraBCD)
        const result = await findUsers({
          where: {
            or: [
              { id: carlosSilvaAB.id },
              {
                and: [{ lastName: "Oliveira" }, { id: joaoOliveiraBCD.id }],
              },
            ],
          },
        });

        // carlosSilvaAB + joaoOliveiraBCD
        expect(result).toHaveLength(2);
        expect(
          result.every(
            (r) =>
              r.id === carlosSilvaAB.id ||
              (r.lastName === "Oliveira" && r.id === joaoOliveiraBCD.id),
          ),
        ).toBe(true);
      });

      test("filters with nested 'or' inside 'and'", async () => {
        // Find users that are:
        // - lastName "Oliveira" AND
        // - (id = joaoOliveiraBCD OR id = pedroOliveira)
        const result = await findUsers({
          where: {
            and: [
              { lastName: "Oliveira" },
              {
                or: [{ id: joaoOliveiraBCD.id }, { id: pedroOliveira.id }],
              },
            ],
          },
        });

        expect(result).toHaveLength(2);
        expect(
          result.every(
            (r) =>
              r.lastName === "Oliveira" &&
              (r.id === joaoOliveiraBCD.id || r.id === pedroOliveira.id),
          ),
        ).toBe(true);
      });

      test("filters with deeply nested logical operators (3 levels)", async () => {
        // Find users that are:
        // - lastName "Oliveira" OR
        // - (lastName "Silva" AND (id = carlosSilvaAB OR id = mariaSantosB))
        const result = await findUsers({
          where: {
            or: [
              { lastName: "Oliveira" },
              {
                and: [
                  { lastName: "Silva" },
                  {
                    or: [{ id: carlosSilvaAB.id }, { id: mariaSantosB.id }],
                  },
                ],
              },
            ],
          },
        });

        // joaoOliveiraBCD, pedroOliveira, carlosSilvaAB
        expect(result).toHaveLength(3);
        expect(
          result.every(
            (r) =>
              r.lastName === "Oliveira" ||
              (r.lastName === "Silva" &&
                (r.id === carlosSilvaAB.id || r.id === mariaSantosB.id)),
          ),
        ).toBe(true);
      });

      test("filters with explicit operators inside logical operators", async () => {
        // Find users where:
        // - lastName = Oliveira AND id != joaoOliveiraBCD
        const result = await findUsers({
          where: {
            and: [
              { lastName: { operator: "eq", value: "Oliveira" } },
              { id: { operator: "ne", value: joaoOliveiraBCD.id } },
            ],
          },
        });

        expect(result).toHaveLength(1);
        expect(result[0]!.id).toBe(pedroOliveira.id);
      });

      test("filters with 'or' combining column filters", async () => {
        // Find users where:
        // - (lastName "Oliveira" AND id = pedroOliveira) OR lastName = Silva
        const result = await findUsers({
          where: {
            or: [
              {
                and: [{ lastName: "Oliveira" }, { id: pedroOliveira.id }],
              },
              { lastName: "Silva" },
            ],
          },
        });

        // pedroOliveira + carlosSilvaAB
        expect(result).toHaveLength(2);
        expect(
          result.every(
            (r) =>
              (r.lastName === "Oliveira" && r.id === pedroOliveira.id) ||
              r.lastName === "Silva",
          ),
        ).toBe(true);
      });

      test("returns all when 'and' has empty array", async () => {
        const result = await findUsers({
          where: { and: [] },
        });

        expect(result).toHaveLength(6);
      });

      test("returns all when 'or' has empty array", async () => {
        const result = await findUsers({
          where: { or: [] },
        });

        expect(result).toHaveLength(6);
      });

      test("filters with 'not' at root level", async () => {
        // Find users whose lastName is NOT "Oliveira"
        const result = await findUsers({
          where: { not: { lastName: "Oliveira" } },
        });

        expect(result).toHaveLength(4);
        expect(result.every((r) => r.lastName !== "Oliveira")).toBe(true);
      });

      test("filters with 'not' negating multiple column filters", async () => {
        // Find users that are NOT (lastName "Silva" AND carlosSilvaAB)
        const result = await findUsers({
          where: {
            not: {
              lastName: "Silva",
              id: carlosSilvaAB.id,
            },
          },
        });

        // All except carlosSilvaAB
        expect(result).toHaveLength(5);
        expect(
          result.every(
            (r) => !(r.lastName === "Silva" && r.id === carlosSilvaAB.id),
          ),
        ).toBe(true);
      });

      test("filters with 'not' inside 'and'", async () => {
        // Find users with lastName "Oliveira" AND NOT joaoOliveiraBCD
        const result = await findUsers({
          where: {
            and: [
              { lastName: "Oliveira" },
              { not: { id: joaoOliveiraBCD.id } },
            ],
          },
        });

        expect(result).toHaveLength(1);
        expect(result[0]!.id).toBe(pedroOliveira.id);
      });

      test("filters with 'not' inside 'or'", async () => {
        // Find users with lastName "Oliveira" OR NOT lastName "Silva"
        const result = await findUsers({
          where: {
            or: [{ lastName: "Oliveira" }, { not: { lastName: "Silva" } }],
          },
        });

        // All except carlosSilvaAB
        expect(result).toHaveLength(5);
        expect(
          result.every(
            (r) => r.lastName === "Oliveira" || r.lastName !== "Silva",
          ),
        ).toBe(true);
      });

      test("filters with 'not' wrapping 'or'", async () => {
        // Find users that are NOT (lastName "Oliveira" OR id = carlosSilvaAB)
        const result = await findUsers({
          where: {
            not: {
              or: [{ lastName: "Oliveira" }, { id: carlosSilvaAB.id }],
            },
          },
        });

        // mariaSantosB, anaCostaAdmin, lucasFerreiraAdmin
        expect(result).toHaveLength(3);
        expect(
          result.every(
            (r) => r.lastName !== "Oliveira" && r.id !== carlosSilvaAB.id,
          ),
        ).toBe(true);
      });

      test("filters with nested 'not' inside 'not'", async () => {
        // Find users that are NOT (NOT "Oliveira") = "Oliveira"
        const result = await findUsers({
          where: {
            not: {
              not: { lastName: "Oliveira" },
            },
          },
        });

        // Double negation: lastName "Oliveira" records
        expect(result).toHaveLength(2);
        expect(result.every((r) => r.lastName === "Oliveira")).toBe(true);
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

      expect(result).toHaveLength(4);
      expect(result[0]!.id).toBe(allResults[2]!.id);
    });
  });

  describe("ordering", () => {
    test("ascending by createdAt", async () => {
      const result = await findUsers({
        orderBy: { createdAt: "asc" },
      });

      expect(result).toHaveLength(6);

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

      expect(result).toHaveLength(6);

      for (let i = 1; i < result.length; i++) {
        const prev = new Date(result[i - 1]!.createdAt).getTime();
        const curr = new Date(result[i]!.createdAt).getTime();
        expect(curr).toBeLessThanOrEqual(prev);
      }
    });
  });
});
