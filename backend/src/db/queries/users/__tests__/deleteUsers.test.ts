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
import { deleteUsers, findUser, findUsers } from "..";

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
    await Promise.all([
      deleteUsers({ where: { id: pedroOliveira.id } }),
      deleteUsers({ where: { id: anaCostaAdmin.id } }),
    ]);
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
      expect(deleted[0]!.email).toBe(pedroOliveira.email);

      // Verify it no longer exists
      const remaining = await findUsers({ where: { id: pedroOliveira.id } });
      expect(remaining).toEqual([]);
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
      const remaining = await findUser({ where: { id: anaCostaAdmin.id } });
      expect(remaining.id).toBe(anaCostaAdmin.id);
    });

    test("throws when where has no filters", async () => {
      await expect(deleteUsers({ where: {} })).rejects.toThrow(
        "At least one where filter must be provided",
      );
    });
  });
});
