import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { DbError } from "../../../../shared/utils/errors";
import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent } from "../../../../tests/setup";
import { findOneUser, updateUsers } from "..";

describe("db/queries/users/updateUsers.ts", () => {
  let pedroOliveira: MockUser;
  let anaCostaAdmin: MockUser;

  beforeAll(async () => {
    await agent.seed({
      users: ["pedroOliveira", "anaCostaAdmin"],
    });

    pedroOliveira = agent.getFixture({ user: "pedroOliveira" });
    anaCostaAdmin = agent.getFixture({ user: "anaCostaAdmin" });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("updateUsers", () => {
    test("updates a single user by id", async () => {
      const updated = await updateUsers({
        where: { id: pedroOliveira.id },
        values: { firstName: "UpdatedName" },
      });

      expect(updated).toHaveLength(1);
      expect(updated[0]!.firstName).toBe("UpdatedName");

      // Verify persistence
      const persisted = await findOneUser({ where: { id: pedroOliveira.id } });
      expect(persisted.firstName).toBe("UpdatedName");

      // Revert
      await updateUsers({
        where: { id: pedroOliveira.id },
        values: { firstName: pedroOliveira.firstName },
      });
    });

    test("updates multiple fields at once", async () => {
      const updated = await updateUsers({
        where: { id: pedroOliveira.id },
        values: {
          firstName: "Multi",
          lastName: "Update",
          email: "multi.update@test.com",
        },
      });

      expect(updated).toHaveLength(1);
      expect(updated[0]!.firstName).toBe("Multi");
      expect(updated[0]!.lastName).toBe("Update");
      expect(updated[0]!.email).toBe("multi.update@test.com");

      // Revert
      await updateUsers({
        where: { id: pedroOliveira.id },
        values: {
          firstName: pedroOliveira.firstName,
          lastName: pedroOliveira.lastName,
          email: pedroOliveira.email,
        },
      });
    });

    test("sets a nullable column to null", async () => {
      const updated = await updateUsers({
        where: { id: pedroOliveira.id },
        values: { email: null },
      });

      expect(updated).toHaveLength(1);
      expect(updated[0]!.email).toBeNull();

      // Revert
      await updateUsers({
        where: { id: pedroOliveira.id },
        values: { email: pedroOliveira.email },
      });
    });

    test("throws DbError when updating email to one already in use", async () => {
      await expect(
        updateUsers({
          where: { id: pedroOliveira.id },
          values: { email: anaCostaAdmin.email },
        }),
      ).rejects.toThrow(DbError);

      // Verify the original email is unchanged
      const persisted = await findOneUser({ where: { id: pedroOliveira.id } });
      expect(persisted.email).toBe(pedroOliveira.email);
    });

    test("returns empty array when no user matches the filter", async () => {
      const result = await updateUsers({
        where: { id: "00000000-0000-0000-0000-000000000000" },
        values: { firstName: "Ghost" },
      });

      expect(result).toEqual([]);
    });

    test("updates multiple users matching an OR filter", async () => {
      const updated = await updateUsers({
        where: {
          or: [{ id: pedroOliveira.id }, { id: anaCostaAdmin.id }],
        },
        values: { lastName: "TestName" },
      });

      expect(updated).toHaveLength(2);
      expect(updated.every((u) => u.lastName === "TestName")).toBe(true);

      // Revert
      await Promise.all([
        updateUsers({
          where: { id: pedroOliveira.id },
          values: { lastName: pedroOliveira.lastName },
        }),
        updateUsers({
          where: { id: anaCostaAdmin.id },
          values: { lastName: anaCostaAdmin.lastName },
        }),
      ]);
    });

    test("returns updated records with refreshed updatedAt", async () => {
      const before = await findOneUser({ where: { id: pedroOliveira.id } });
      const oldUpdatedAt = before.updatedAt;

      const updated = await updateUsers({
        where: { id: pedroOliveira.id },
        values: { firstName: "Timestamp" },
      });

      expect(updated[0]!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime(),
      );

      // Revert
      await updateUsers({
        where: { id: pedroOliveira.id },
        values: { firstName: pedroOliveira.firstName },
      });
    });
  });

  describe("strict mode safety", () => {
    test("throws when and clause is empty", async () => {
      await expect(
        updateUsers({
          // @ts-expect-error Testing invalid where clause
          where: { and: [] },
          values: { firstName: "x" },
        }),
      ).rejects.toThrow("Strict mode");
    });

    test("throws when or clause is empty", async () => {
      await expect(
        updateUsers({
          // @ts-expect-error Testing invalid where clause
          where: { or: [] },
          values: { firstName: "x" },
        }),
      ).rejects.toThrow("Strict mode");
    });

    test("throws when nested clauses resolve to empty", async () => {
      await expect(
        updateUsers({
          // @ts-expect-error Testing invalid where clause
          where: { and: [{ or: [] }] },
          values: { firstName: "x" },
        }),
      ).rejects.toThrow("Strict mode");
    });
  });
});
