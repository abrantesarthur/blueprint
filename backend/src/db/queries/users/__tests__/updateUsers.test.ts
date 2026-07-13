import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { DbError } from "../../../../shared/utils/errors";
import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent } from "../../../../tests/setup";
import { findUser, updateUsers } from "..";

describe("db/queries/users/updateUsers.ts", () => {
  let pedroOliveira: MockUser;
  let anaCostaAdmin: MockUser;
  let joaoOliveiraBCD: MockUser;

  beforeAll(async () => {
    await agent.seed({
      users: ["pedroOliveira", "anaCostaAdmin", "joaoOliveiraBCD"],
    });

    pedroOliveira = agent.getFixture({ user: "pedroOliveira" });
    anaCostaAdmin = agent.getFixture({ user: "anaCostaAdmin" });
    joaoOliveiraBCD = agent.getFixture({ user: "joaoOliveiraBCD" });
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
      const persisted = await findUser({ where: { id: pedroOliveira.id } });
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
      expect(updated[0]).toMatchObject({
        firstName: "Multi",
        lastName: "Update",
        email: "multi.update@test.com",
      });

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
      const persisted = await findUser({ where: { id: pedroOliveira.id } });
      expect(persisted.email).toBe(pedroOliveira.email);
    });

    test("returns empty array when no user matches the filter", async () => {
      const result = await updateUsers({
        where: { id: "00000000-0000-0000-0000-000000000000" },
        values: { firstName: "Ghost" },
      });

      expect(result).toEqual([]);
    });

    test("updates all users matching the filter", async () => {
      const updated = await updateUsers({
        where: { lastName: "Oliveira" },
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
          where: { id: joaoOliveiraBCD.id },
          values: { lastName: joaoOliveiraBCD.lastName },
        }),
      ]);
    });

    test("returns updated records with refreshed updatedAt", async () => {
      const before = await findUser({ where: { id: pedroOliveira.id } });
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

    test("throws when where has no filters", async () => {
      await expect(
        updateUsers({
          where: {},
          values: { firstName: "x" },
        }),
      ).rejects.toThrow("At least one where filter must be provided");
    });
  });
});
