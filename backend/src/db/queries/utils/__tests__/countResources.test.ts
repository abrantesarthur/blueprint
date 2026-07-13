import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { agent, testDb } from "../../../../tests/setup";
import { users } from "../../../schema";
import { countResources } from "../countResources";

describe("db/queries/utils/countResources.ts", () => {
  beforeAll(async () => {
    // Last-name groups: Silva (1), Santos (1), Oliveira (2).
    await agent.seed({
      users: [
        "carlosSilvaAB",
        "mariaSantosB",
        "joaoOliveiraBCD",
        "pedroOliveira",
      ],
    });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("simple count", () => {
    test("returns total count of all rows when no options provided", async () => {
      const result = await countResources({ table: users });

      expect(result).toBe(4);
    });

    test("returns filtered count with where clause", async () => {
      const result = await countResources({
        table: users,
        where: { lastName: "Oliveira" },
      });

      expect(result).toBe(2);
    });

    test("returns count with null-column filter", async () => {
      const result = await countResources({
        table: users,
        where: { email: null },
      });

      expect(result).toBe(1);
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
        groupBy: ["lastName"],
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual({
        lastName: "Oliveira",
        count: 2,
      });
      expect(result).toContainEqual({
        lastName: "Silva",
        count: 1,
      });
    });

    test("groups by multiple columns and returns array with all groupBy columns and count", async () => {
      const result = await countResources({
        table: users,
        groupBy: ["lastName", "firstName"],
        where: { lastName: "Oliveira" },
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        lastName: "Oliveira",
        firstName: "Joao",
        count: 1,
      });
      expect(result).toContainEqual({
        lastName: "Oliveira",
        firstName: "Pedro",
        count: 1,
      });
    });
  });

  describe("grouped count with having", () => {
    test("filters grouped results using having clause with gte operator", async () => {
      const result = await countResources({
        table: users,
        groupBy: ["lastName"],
        having: { count: { value: 2, operator: "gte" } },
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result).toContainEqual({
        lastName: "Oliveira",
        count: 2,
      });
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
