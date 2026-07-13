import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { NotFoundError } from "../../../../shared/utils/errors";
import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent } from "../../../../tests/setup";
import { findUser } from "..";

describe("db/queries/users/findUser.ts", () => {
  const MISSING_ID = "00000000-0000-0000-0000-000000000000";

  let pedroOliveira: MockUser;
  let joaoOliveiraBCD: MockUser;

  beforeAll(async () => {
    await agent.seed({
      users: ["pedroOliveira", "carlosSilvaAB", "joaoOliveiraBCD"],
    });

    pedroOliveira = agent.getFixture({ user: "pedroOliveira" });
    joaoOliveiraBCD = agent.getFixture({ user: "joaoOliveiraBCD" });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("findUser", () => {
    test("returns the full user record when found", async () => {
      const result = await findUser({
        where: { id: pedroOliveira.id },
      });

      expect(result).toMatchObject({
        id: pedroOliveira.id,
        email: pedroOliveira.email,
        firstName: pedroOliveira.firstName,
        lastName: pedroOliveira.lastName,
      });
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test("throws NotFoundError when no user matches", async () => {
      await expect(
        findUser({ where: { id: MISSING_ID } }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(findUser({ where: { id: MISSING_ID } })).rejects.toThrow(
        "User not found",
      );
    });

    test("finds user by email", async () => {
      const result = await findUser({
        where: { email: pedroOliveira.email },
      });

      expect(result.id).toBe(pedroOliveira.id);
      expect(result.email).toBe(pedroOliveira.email);
    });

    test("finds user by null email", async () => {
      const result = await findUser({
        where: { email: null },
      });

      expect(result.id).toBe(joaoOliveiraBCD.id);
      expect(result.email).toBeNull();
    });

    test("finds user by firstName", async () => {
      const result = await findUser({
        where: { firstName: pedroOliveira.firstName },
      });

      expect(result.firstName).toBe(pedroOliveira.firstName);
    });

    test("combines filters with AND", async () => {
      const result = await findUser({
        where: { lastName: pedroOliveira.lastName, id: pedroOliveira.id },
      });

      expect(result.id).toBe(pedroOliveira.id);
      expect(result.lastName).toBe(pedroOliveira.lastName);
    });

    test("throws NotFoundError when combined filters match no user", async () => {
      await expect(
        findUser({
          where: { id: pedroOliveira.id, lastName: "Nonexistent" },
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
