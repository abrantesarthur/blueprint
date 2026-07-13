import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { NotFoundError } from "../../../../shared/utils/errors";
import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent } from "../../../../tests/setup";
import type { User } from "../../../schema";
import { findOneUser } from "..";

describe("db/queries/users/findOneUser.ts", () => {
  let pedroOliveira: MockUser;
  let joaoOliveiraBCD: MockUser;
  let seededUser: User;

  beforeAll(async () => {
    await agent.seed({
      users: ["pedroOliveira", "carlosSilvaAB", "joaoOliveiraBCD"],
    });

    pedroOliveira = agent.getFixture({ user: "pedroOliveira" });
    joaoOliveiraBCD = agent.getFixture({ user: "joaoOliveiraBCD" });

    // Fetch seeded user to get actual timestamps
    seededUser = await findOneUser({
      where: { id: pedroOliveira.id },
    });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("require", () => {
    test("returns user when found", async () => {
      const result = await findOneUser({
        where: { id: pedroOliveira.id },
      });

      expect(result.id).toBe(pedroOliveira.id);
    });

    test("throws NotFoundError when user not found (default)", async () => {
      await expect(
        findOneUser({
          where: { id: "00000000-0000-0000-0000-000000000000" },
        }),
      ).rejects.toThrow(NotFoundError);
    });

    test("returns null when user not found with require: false", async () => {
      const result = await findOneUser({
        where: { id: "00000000-0000-0000-0000-000000000000" },
        require: false,
      });

      expect(result).toBeNull();
    });
  });

  describe("where", () => {
    test("finds user by id", async () => {
      const result = await findOneUser({
        where: { id: pedroOliveira.id },
      });

      expect(result.id).toBe(pedroOliveira.id);
    });

    test("finds user by email", async () => {
      const result = await findOneUser({
        where: { email: pedroOliveira.email },
      });

      expect(result.id).toBe(pedroOliveira.id);
      expect(result.email).toBe(pedroOliveira.email);
    });

    test("finds user by firstName", async () => {
      const result = await findOneUser({
        where: { firstName: pedroOliveira.firstName },
      });

      expect(result.firstName).toBe(pedroOliveira.firstName);
    });

    test("finds user by lastName", async () => {
      const result = await findOneUser({
        where: { lastName: pedroOliveira.lastName, id: pedroOliveira.id },
      });

      expect(result.lastName).toBe(pedroOliveira.lastName);
    });

    test("finds user by email (null)", async () => {
      const result = await findOneUser({
        where: { email: null },
      });

      expect(result.id).toBe(joaoOliveiraBCD.id);
      expect(result.email).toBeNull();
    });

    test("finds user by createdAt", async () => {
      const result = await findOneUser({
        where: { createdAt: seededUser.createdAt, id: pedroOliveira.id },
      });

      expect(result.id).toBe(pedroOliveira.id);
    });

    test("finds user by createdAt with lte operator", async () => {
      const result = await findOneUser({
        where: {
          createdAt: { value: seededUser.createdAt, operator: "lte" },
          id: pedroOliveira.id,
        },
      });

      expect(result.id).toBe(pedroOliveira.id);
    });

    test("finds user by updatedAt", async () => {
      const result = await findOneUser({
        where: { updatedAt: seededUser.updatedAt, id: pedroOliveira.id },
      });

      expect(result.id).toBe(pedroOliveira.id);
    });

    test("finds user by updatedAt with gte operator", async () => {
      const result = await findOneUser({
        where: {
          updatedAt: { value: seededUser.updatedAt, operator: "gte" },
          id: pedroOliveira.id,
        },
      });

      expect(result.id).toBe(pedroOliveira.id);
    });
  });
});
