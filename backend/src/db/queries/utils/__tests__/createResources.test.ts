import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { DbError } from "../../../../shared/utils/errors";
import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent, testDb } from "../../../../tests/setup";
import { otpCodes } from "../../../schema/otpCodes";
import { users } from "../../../schema/users";
import { createResources } from "../createResources";

describe("db/queries/utils/createResources.ts", () => {
  let seededUser: MockUser;

  beforeAll(async () => {
    await agent.seed({
      users: ["pedroOliveira"],
    });

    seededUser = agent.getFixture({ user: "pedroOliveira" });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("createResources", () => {
    test("inserts a single record and returns it in an array", async () => {
      const [result] = await createResources({
        table: users,
        data: [
          {
            phone: "+5521988888888",
            firstName: "Single",
            lastName: "Insert",
            role: "user",
          },
        ],
      });

      expect(result!.id).toBeDefined();
      expect(result).toMatchObject({
        phone: "+5521988888888",
        firstName: "Single",
        lastName: "Insert",
        role: "user",
      });

      // Cleanup
      await testDb.delete(users).where(eq(users.id, result!.id));
    });

    test("inserts multiple records and returns all of them", async () => {
      const results = await createResources({
        table: users,
        data: [
          {
            phone: "+5521977777771",
            firstName: "Multi",
            lastName: "One",
            role: "user",
          },
          {
            phone: "+5521977777772",
            firstName: "Multi",
            lastName: "Two",
            role: "admin",
          },
        ],
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        firstName: "Multi",
        lastName: "One",
      });
      expect(results[1]).toMatchObject({
        firstName: "Multi",
        lastName: "Two",
      });

      // Cleanup
      await Promise.all(
        results.map((u) => testDb.delete(users).where(eq(users.id, u.id))),
      );
    });

    test("supports transaction via tx parameter", async () => {
      const results = await testDb.transaction(async (tx) => {
        return createResources({
          table: users,
          data: [
            {
              phone: "+5521966666666",
              firstName: "Transactional",
              lastName: "Insert",
              role: "user",
            },
          ],
          tx,
        });
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        firstName: "Transactional",
        lastName: "Insert",
      });

      // Cleanup
      await testDb.delete(users).where(eq(users.id, results[0]!.id));
    });

    test("wraps database errors in DbError", async () => {
      await expect(
        createResources({
          table: users,
          data: [
            {
              phone: seededUser.phone,
              firstName: "Duplicate",
              lastName: "Phone",
              role: "user",
            },
          ],
        }),
      ).rejects.toThrow(DbError);
    });

    test("upserts record when onConflictDoUpdate is provided", async () => {
      const expiresAt = new Date(Date.now() + 300_000);

      const [original] = await createResources({
        table: otpCodes,
        data: [
          {
            phone: seededUser.phone,
            code: "original-code",
            requestToken: "ab".repeat(32),
            expiresAt,
          },
        ],
      });

      const newCode = "upserted-code";
      const newExpiresAt = new Date(Date.now() + 600_000);

      const [upserted] = await createResources({
        table: otpCodes,
        data: [
          {
            phone: seededUser.phone,
            code: newCode,
            requestToken: "ab".repeat(32),
            expiresAt: newExpiresAt,
          },
        ],
        onConflictDoUpdate: {
          target: "phone",
          set: {
            code: newCode,
            expiresAt: newExpiresAt,
            attempts: 0,
          },
        },
      });

      expect(upserted!.id).toBe(original!.id);
      expect(upserted!.code).toBe(newCode);
      expect(upserted!.expiresAt).toEqual(newExpiresAt);
      expect(upserted!.attempts).toBe(0);

      // Cleanup
      await testDb.delete(otpCodes).where(eq(otpCodes.id, upserted!.id));
    });

    test("inserts normally when onConflictDoUpdate is provided but no conflict exists", async () => {
      const expiresAt = new Date(Date.now() + 300_000);

      const [result] = await createResources({
        table: otpCodes,
        data: [
          {
            phone: seededUser.phone,
            code: "no-conflict-code",
            requestToken: "ab".repeat(32),
            expiresAt,
          },
        ],
        onConflictDoUpdate: {
          target: "phone",
          set: {
            code: "should-not-be-used",
            expiresAt: new Date(Date.now() + 999_000),
            attempts: 5,
          },
        },
      });

      expect(result!.phone).toBe(seededUser.phone);
      expect(result!.code).toBe("no-conflict-code");
      expect(result!.expiresAt).toEqual(expiresAt);
      expect(result!.attempts).toBe(0);

      // Cleanup
      await testDb.delete(otpCodes).where(eq(otpCodes.id, result!.id));
    });

    test("supports array conflict target for composite unique constraints", async () => {
      const expiresAt = new Date(Date.now() + 300_000);

      const [original] = await createResources({
        table: otpCodes,
        data: [
          {
            phone: seededUser.phone,
            code: "array-target-code",
            requestToken: "ab".repeat(32),
            expiresAt,
          },
        ],
      });

      const newCode = "array-target-upserted";

      const [upserted] = await createResources({
        table: otpCodes,
        data: [
          {
            phone: seededUser.phone,
            code: newCode,
            requestToken: "ab".repeat(32),
            expiresAt,
          },
        ],
        onConflictDoUpdate: {
          target: ["phone"],
          set: {
            code: newCode,
          },
        },
      });

      expect(upserted!.id).toBe(original!.id);
      expect(upserted!.code).toBe(newCode);

      // Cleanup
      await testDb.delete(otpCodes).where(eq(otpCodes.id, upserted!.id));
    });
  });
});
