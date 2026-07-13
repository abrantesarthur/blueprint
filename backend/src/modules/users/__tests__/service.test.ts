import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";

import { deleteUsers, findOneUser } from "../../../db";
import type { MockUser } from "../../../tests/mock-data/users/types";
import { agent } from "../../../tests/setup";
import { createUser, deleteUserAccount, getUser, updateUser } from "../service";

describe("users/service.ts", () => {
  let primaryUser: MockUser;

  beforeAll(async () => {
    await agent.seed({ users: ["carlosSilvaAB"] });
    primaryUser = agent.getFixture({ user: "carlosSilvaAB" });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("createUser", () => {
    /** User ids created by these tests — cleaned up in afterAll. */
    const createdUserIds: string[] = [];

    afterAll(async () => {
      await Promise.all(
        createdUserIds.map((id) =>
          deleteUsers({ where: { id } }).catch(() => {}),
        ),
      );
    });

    test("creates a new user and returns the created record", async () => {
      const result = await createUser({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@test.com",
      });

      createdUserIds.push(result.id);

      expect(result.id).toBeString();
      expect(result).toMatchObject({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@test.com",
      });
      expect(result.createdAt).toBeInstanceOf(Date);

      const createdRow = await findOneUser({
        where: { id: result.id },
        require: false,
      });
      expect(createdRow).not.toBeNull();
      expect(createdRow!.email).toBe("john.doe@test.com");
    });

    test("creates a user without an email and stores it as null", async () => {
      const result = await createUser({
        firstName: "Jane",
        lastName: "Doe",
      });

      createdUserIds.push(result.id);

      expect(result).toMatchObject({
        firstName: "Jane",
        lastName: "Doe",
        email: null,
      });
    });

    test("throws ConflictError when the email is already registered", async () => {
      await expect(
        createUser({
          firstName: "Jane",
          lastName: "Smith",
          email: primaryUser.email!,
        }),
      ).rejects.toThrow("A user with this email address already exists");
    });
  });

  describe("updateUser", () => {
    let otherUser: MockUser;

    beforeAll(async () => {
      await agent.seed({ users: ["mariaSantosB"] });
      otherUser = agent.getFixture({ user: "mariaSantosB" });
    });

    afterAll(async () => {
      await deleteUsers({ where: { id: otherUser.id } });
    });

    afterEach(async () => {
      await deleteUsers({ where: { id: primaryUser.id } });
      await agent.seed({ users: ["carlosSilvaAB"] });
    });

    test("patches firstName only, leaving the other fields unchanged", async () => {
      const result = await updateUser({
        userId: primaryUser.id,
        body: { firstName: "Updated" },
      });

      expect(result).toMatchObject({
        firstName: "Updated",
        lastName: primaryUser.lastName,
        email: primaryUser.email,
      });
    });

    test("patches lastName only, leaving the other fields unchanged", async () => {
      const result = await updateUser({
        userId: primaryUser.id,
        body: { lastName: "Renamed" },
      });

      expect(result).toMatchObject({
        firstName: primaryUser.firstName,
        lastName: "Renamed",
        email: primaryUser.email,
      });
    });

    test("patches email only, leaving the other fields unchanged", async () => {
      const result = await updateUser({
        userId: primaryUser.id,
        body: { email: "new-email@test.com" },
      });

      expect(result).toMatchObject({
        firstName: primaryUser.firstName,
        lastName: primaryUser.lastName,
        email: "new-email@test.com",
      });
    });

    test("updates all allowed fields together", async () => {
      const result = await updateUser({
        userId: primaryUser.id,
        body: {
          firstName: "Updated",
          lastName: "Name",
          email: "updated.name@test.com",
        },
      });

      expect(result).toMatchObject({
        firstName: "Updated",
        lastName: "Name",
        email: "updated.name@test.com",
      });
    });

    test("bumps updatedAt", async () => {
      const before = await findOneUser({ where: { id: primaryUser.id } });
      await new Promise((r) => {
        setTimeout(r, 5);
      });

      const after = await updateUser({
        userId: primaryUser.id,
        body: { firstName: "Bumped" },
      });

      expect(after.updatedAt.getTime()).toBeGreaterThan(
        before.updatedAt.getTime(),
      );
    });

    test("throws ConflictError when the email already belongs to another user", async () => {
      await expect(
        updateUser({
          userId: primaryUser.id,
          body: { email: otherUser.email! },
        }),
      ).rejects.toThrow("A user with this email address already exists");
    });

    test("throws NotFoundError when the user does not exist", async () => {
      await expect(
        updateUser({
          userId: "00000000-0000-0000-0000-000000000000",
          body: { firstName: "Ghost" },
        }),
      ).rejects.toThrow("Could not find the user!");
    });
  });

  describe("deleteUserAccount", () => {
    test("permanently deletes the user from the database", async () => {
      const before = await findOneUser({
        where: { id: primaryUser.id },
        require: false,
      });
      expect(before).not.toBeNull();

      await deleteUserAccount(primaryUser.id);

      const after = await findOneUser({
        where: { id: primaryUser.id },
        require: false,
      });
      expect(after).toBeNull();

      // Restore the user so other tests in this file can rely on it.
      await agent.seed({ users: ["carlosSilvaAB"] });
    });
  });

  describe("getUser", () => {
    let otherUser: MockUser;

    beforeAll(async () => {
      await agent.seed({ users: ["mariaSantosB"] });
      otherUser = agent.getFixture({ user: "mariaSantosB" });
    });

    afterAll(async () => {
      await deleteUsers({ where: { id: otherUser.id } });
    });

    test("returns the user record when the caller is the owner", async () => {
      const dbUser = await findOneUser({ where: { id: primaryUser.id } });

      const result = await getUser({
        userId: primaryUser.id,
        authUser: primaryUser,
      });

      expect(result).toMatchObject({
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
      });
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    test("throws ForbiddenError when the caller is not the owner", async () => {
      await expect(
        getUser({
          userId: primaryUser.id,
          authUser: otherUser,
        }),
      ).rejects.toThrow("Access denied");
    });

    test("throws NotFoundError when the owner's record no longer exists", async () => {
      await deleteUsers({ where: { id: primaryUser.id } });

      try {
        await expect(
          getUser({
            userId: primaryUser.id,
            authUser: primaryUser,
          }),
        ).rejects.toThrow("Could not find the user!");
      } finally {
        await agent.seed({ users: ["carlosSilvaAB"] });
      }
    });
  });
});
