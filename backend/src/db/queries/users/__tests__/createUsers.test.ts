import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { DbError } from "../../../../shared/utils/errors";
import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent } from "../../../../tests/setup";
import { createUsers, deleteUsers } from "..";

describe("db/queries/users/createUsers.ts", () => {
  let carlosSilvaAB: MockUser;

  beforeAll(async () => {
    await agent.seed({
      users: ["carlosSilvaAB"],
    });

    carlosSilvaAB = agent.getFixture({ user: "carlosSilvaAB" });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("createUsers", () => {
    test("creates a new user and returns the created record", async () => {
      const [result] = await createUsers({
        data: [
          {
            email: "john.doe@example.com",
            firstName: "John",
            lastName: "Doe",
          },
        ],
      });

      expect(result!.id).toBeDefined();
      expect(result).toMatchObject({
        email: "john.doe@example.com",
        firstName: "John",
        lastName: "Doe",
      });
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.updatedAt).toBeInstanceOf(Date);

      await deleteUsers({ where: { id: result!.id } });
    });

    test("throws DbError on duplicate email", async () => {
      await expect(
        createUsers({
          data: [
            {
              email: carlosSilvaAB.email,
              firstName: "Duplicate",
              lastName: "Email",
            },
          ],
        }),
      ).rejects.toThrow(DbError);
    });

    test("creates user with minimal required fields", async () => {
      const [result] = await createUsers({
        data: [
          {
            firstName: "Minimal",
            lastName: "User",
          },
        ],
      });

      expect(result!.email).toBeNull();
      expect(result).toMatchObject({
        firstName: "Minimal",
        lastName: "User",
      });

      await deleteUsers({ where: { id: result!.id } });
    });
  });
});
