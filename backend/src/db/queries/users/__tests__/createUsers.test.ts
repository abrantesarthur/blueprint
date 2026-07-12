import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { DbError } from "../../../../shared/utils/errors";
import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent, testDb } from "../../../../tests/setup";
import { users } from "../../../schema";
import { createUsers } from "..";

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
            phone: "+5521999999999",
            firstName: "John",
            lastName: "Doe",
            role: "user",
          },
        ],
      });

      expect(typeof result!.id).toBe("string");
      expect(result!.phone).toBe("+5521999999999");
      expect(result!.firstName).toBe("John");
      expect(result!.lastName).toBe("Doe");
      expect(result!.role).toBe("user");
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.updatedAt).toBeInstanceOf(Date);

      await testDb.delete(users).where(eq(users.id, result!.id));
    });

    test("throws QueryError on duplicate phone number", async () => {
      await expect(
        createUsers({
          data: [
            {
              phone: carlosSilvaAB.phone,
              firstName: "Duplicate",
              lastName: "Phone",
              role: "user",
            },
          ],
        }),
      ).rejects.toThrow(DbError);
    });

    test("creates user with minimal required fields", async () => {
      const [result] = await createUsers({
        data: [
          {
            phone: "+5531999999999",
            firstName: "Minimal",
            lastName: "User",
          },
        ],
      });

      expect(result!.email).toBeNull();
      expect(result!.phoneVerified).toBe(false);
      expect(result!.role).toBe("user");
      expect(result!.otpRequestedAt).toBeNull();

      await testDb.delete(users).where(eq(users.id, result!.id));
    });
  });
});
