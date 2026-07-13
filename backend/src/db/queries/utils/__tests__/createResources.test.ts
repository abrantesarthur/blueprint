import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { DbError } from "../../../../shared/utils/errors";
import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent, testDb } from "../../../../tests/setup";
import { users } from "../../../schema/users";
import { deleteUsers } from "../../users";
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
            email: "single.insert@test.com",
            firstName: "Single",
            lastName: "Insert",
          },
        ],
      });

      expect(result!.id).toBeDefined();
      expect(result).toMatchObject({
        email: "single.insert@test.com",
        firstName: "Single",
        lastName: "Insert",
      });

      // Cleanup
      await deleteUsers({ where: { id: result!.id } });
    });

    test("inserts a record with a null email", async () => {
      const [result] = await createResources({
        table: users,
        data: [
          {
            email: null,
            firstName: "Nullable",
            lastName: "Email",
          },
        ],
      });

      expect(result!.id).toBeDefined();
      expect(result).toMatchObject({
        email: null,
        firstName: "Nullable",
        lastName: "Email",
      });

      // Cleanup
      await deleteUsers({ where: { id: result!.id } });
    });

    test("inserts multiple records and returns all of them", async () => {
      const results = await createResources({
        table: users,
        data: [
          {
            email: "multi.one@test.com",
            firstName: "Multi",
            lastName: "One",
          },
          {
            email: "multi.two@test.com",
            firstName: "Multi",
            lastName: "Two",
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
      await deleteUsers({
        where: { id: { value: results.map((u) => u.id), operator: "in" } },
      });
    });

    test("supports transaction via tx parameter", async () => {
      const results = await testDb.transaction(async (tx) => {
        return createResources({
          table: users,
          data: [
            {
              email: "transactional.insert@test.com",
              firstName: "Transactional",
              lastName: "Insert",
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
      await deleteUsers({ where: { id: results[0]!.id } });
    });

    test("wraps database errors in DbError", async () => {
      await expect(
        createResources({
          table: users,
          data: [
            {
              email: seededUser.email,
              firstName: "Duplicate",
              lastName: "Email",
            },
          ],
        }),
      ).rejects.toThrow(DbError);
    });

    test("throws when onConflictDoUpdate and onConflictDoNothing are both provided", async () => {
      await expect(
        createResources({
          table: users,
          data: [
            {
              email: "mutually.exclusive@test.com",
              firstName: "Mutually",
              lastName: "Exclusive",
            },
          ],
          onConflictDoUpdate: { target: "email", set: { firstName: "A" } },
          onConflictDoNothing: { target: "email" },
        }),
      ).rejects.toThrow(
        "createResources: onConflictDoUpdate and onConflictDoNothing are mutually exclusive",
      );
    });

    test("upserts record when onConflictDoUpdate is provided", async () => {
      const email = "upsert.target@test.com";

      const [original] = await createResources({
        table: users,
        data: [{ email, firstName: "Original", lastName: "Name" }],
      });

      const [upserted] = await createResources({
        table: users,
        data: [{ email, firstName: "Ignored", lastName: "Ignored" }],
        onConflictDoUpdate: {
          target: "email",
          set: {
            firstName: "Updated",
            lastName: "Surname",
          },
        },
      });

      expect(upserted!.id).toBe(original!.id);
      expect(upserted).toMatchObject({
        email,
        firstName: "Updated",
        lastName: "Surname",
      });

      // Cleanup
      await deleteUsers({ where: { id: upserted!.id } });
    });

    test("inserts normally when onConflictDoUpdate is provided but no conflict exists", async () => {
      const [result] = await createResources({
        table: users,
        data: [
          {
            email: "no.conflict@test.com",
            firstName: "Fresh",
            lastName: "Insert",
          },
        ],
        onConflictDoUpdate: {
          target: "email",
          set: {
            firstName: "ShouldNotBeUsed",
          },
        },
      });

      expect(result).toMatchObject({
        email: "no.conflict@test.com",
        firstName: "Fresh",
        lastName: "Insert",
      });

      // Cleanup
      await deleteUsers({ where: { id: result!.id } });
    });

    test("supports array conflict target", async () => {
      const email = "array.target@test.com";

      const [original] = await createResources({
        table: users,
        data: [{ email, firstName: "Array", lastName: "Target" }],
      });

      const [upserted] = await createResources({
        table: users,
        data: [{ email, firstName: "Ignored", lastName: "Ignored" }],
        onConflictDoUpdate: {
          target: ["email"],
          set: {
            firstName: "ArrayUpserted",
          },
        },
      });

      expect(upserted!.id).toBe(original!.id);
      expect(upserted!.firstName).toBe("ArrayUpserted");

      // Cleanup
      await deleteUsers({ where: { id: upserted!.id } });
    });

    test("returns an empty array when onConflictDoNothing hits a conflict", async () => {
      const results = await createResources({
        table: users,
        data: [
          {
            email: seededUser.email,
            firstName: "Conflicting",
            lastName: "Row",
          },
        ],
        onConflictDoNothing: { target: "email" },
      });

      expect(results).toEqual([]);
    });

    test("inserts normally when onConflictDoNothing is provided but no conflict exists", async () => {
      const [result] = await createResources({
        table: users,
        data: [
          {
            email: "do.nothing.fresh@test.com",
            firstName: "DoNothing",
            lastName: "Fresh",
          },
        ],
        onConflictDoNothing: { target: "email" },
      });

      expect(result).toMatchObject({
        email: "do.nothing.fresh@test.com",
        firstName: "DoNothing",
        lastName: "Fresh",
      });

      // Cleanup
      await deleteUsers({ where: { id: result!.id } });
    });
  });
});
