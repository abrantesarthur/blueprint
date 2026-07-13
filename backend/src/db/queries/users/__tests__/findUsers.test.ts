import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent } from "../../../../tests/setup";
import { findUsers } from "..";

describe("db/queries/users/findUsers.ts", () => {
  let carlosSilvaAB: MockUser;
  let mariaSantosB: MockUser;
  let joaoOliveiraBCD: MockUser;
  let pedroOliveira: MockUser;

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
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("filtering", () => {
    test("filters by id", async () => {
      const result = await findUsers({
        where: { id: carlosSilvaAB.id },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: carlosSilvaAB.id,
        email: carlosSilvaAB.email,
        firstName: carlosSilvaAB.firstName,
        lastName: carlosSilvaAB.lastName,
      });
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
      expect(result[0]!.email).toBeNull();
    });

    test("filters by firstName", async () => {
      const result = await findUsers({
        where: { firstName: mariaSantosB.firstName },
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(mariaSantosB.id);
    });

    test("filters by lastName", async () => {
      const result = await findUsers({
        where: { lastName: "Oliveira" },
      });

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.lastName === "Oliveira")).toBe(true);
    });

    test("combines filters with AND", async () => {
      const result = await findUsers({
        where: { lastName: "Oliveira", id: pedroOliveira.id },
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(pedroOliveira.id);
    });

    test("returns empty for non-existent ID", async () => {
      const result = await findUsers({
        where: { id: "00000000-0000-0000-0000-000000000000" },
      });

      expect(result).toEqual([]);
    });

    test("returns all users when no filters are provided", async () => {
      const result = await findUsers();

      expect(result).toHaveLength(6);
    });

    test("returns all users when where is empty", async () => {
      const result = await findUsers({ where: {} });

      expect(result).toHaveLength(6);
    });
  });

  describe("ordering", () => {
    test("orders ascending by firstName", async () => {
      const result = await findUsers({
        orderBy: { column: "firstName", direction: "asc" },
      });

      expect(result.map((r) => r.firstName)).toEqual([
        "Ana",
        "Carlos",
        "Joao",
        "Lucas",
        "Maria",
        "Pedro",
      ]);
    });

    test("orders descending by firstName", async () => {
      const result = await findUsers({
        orderBy: { column: "firstName", direction: "desc" },
      });

      expect(result.map((r) => r.firstName)).toEqual([
        "Pedro",
        "Maria",
        "Lucas",
        "Joao",
        "Carlos",
        "Ana",
      ]);
    });

    test("orders ascending by createdAt", async () => {
      const result = await findUsers({
        orderBy: { column: "createdAt", direction: "asc" },
      });

      expect(result).toHaveLength(6);

      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.createdAt.getTime()).toBeGreaterThanOrEqual(
          result[i - 1]!.createdAt.getTime(),
        );
      }
    });
  });

  describe("pagination", () => {
    test("respects limit", async () => {
      const result = await findUsers({
        orderBy: { column: "firstName", direction: "asc" },
        limit: 2,
      });

      expect(result.map((r) => r.firstName)).toEqual(["Ana", "Carlos"]);
    });

    test("respects offset", async () => {
      const result = await findUsers({
        orderBy: { column: "firstName", direction: "asc" },
        offset: 4,
      });

      expect(result.map((r) => r.firstName)).toEqual(["Maria", "Pedro"]);
    });

    test("combines limit and offset", async () => {
      const result = await findUsers({
        orderBy: { column: "firstName", direction: "asc" },
        limit: 2,
        offset: 1,
      });

      expect(result.map((r) => r.firstName)).toEqual(["Carlos", "Joao"]);
    });
  });
});
