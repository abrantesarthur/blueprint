import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";

import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent } from "../../../../tests/setup";
import { deleteUsers, findOneUser } from "..";

describe("db/queries/users/deleteUsers.ts", () => {
  let pedroOliveira: MockUser;
  let anaCostaAdmin: MockUser;

  beforeAll(async () => {
    await agent.seed({
      users: ["pedroOliveira", "anaCostaAdmin"],
    });

    pedroOliveira = agent.getFixture({ user: "pedroOliveira" });
    anaCostaAdmin = agent.getFixture({ user: "anaCostaAdmin" });
  });

  afterEach(async () => {
    await deleteUsers({
      where: { or: [{ id: pedroOliveira.id }, { id: anaCostaAdmin.id }] },
    });
    await agent.seed({
      users: ["pedroOliveira", "anaCostaAdmin"],
    });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("deleteUsers", () => {
    test("deletes a user by id and returns the deleted record", async () => {
      const deleted = await deleteUsers({ where: { id: pedroOliveira.id } });

      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.id).toBe(pedroOliveira.id);
      expect(deleted[0]!.phone).toBe(pedroOliveira.phone);

      // Verify it no longer exists
      await expect(
        findOneUser({ where: { id: pedroOliveira.id } }),
      ).rejects.toThrow("User not found");
    });

    test("deletes a user by email", async () => {
      const deleted = await deleteUsers({
        where: { email: pedroOliveira.email },
      });

      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.id).toBe(pedroOliveira.id);
    });

    test("returns empty array when no user matches the filter", async () => {
      const result = await deleteUsers({
        where: { id: "00000000-0000-0000-0000-000000000000" },
      });

      expect(result).toEqual([]);
    });

    test("deletes only the matching user when multiple exist", async () => {
      const deleted = await deleteUsers({ where: { id: pedroOliveira.id } });

      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.id).toBe(pedroOliveira.id);

      // Verify the other user still exists
      const remaining = await findOneUser({
        where: { id: anaCostaAdmin.id },
        require: false,
      });
      expect(remaining).not.toBeNull();
      expect(remaining!.id).toBe(anaCostaAdmin.id);
    });
  });

  describe("strict mode safety", () => {
    test("throws when and clause is empty", async () => {
      await expect(
        // @ts-expect-error Testing invalid where clause
        deleteUsers({ where: { and: [] } }),
      ).rejects.toThrow("Strict mode");
    });

    test("throws when or clause is empty", async () => {
      await expect(
        // @ts-expect-error Testing invalid where clause
        deleteUsers({ where: { or: [] } }),
      ).rejects.toThrow("Strict mode");
    });

    test("throws when nested clauses resolve to empty", async () => {
      await expect(
        deleteUsers({
          // @ts-expect-error Testing invalid where clause
          where: { and: [{ or: [] }] },
        }),
      ).rejects.toThrow("Strict mode");
    });
  });
});
