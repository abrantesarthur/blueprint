import { hashSha256 } from "@blueprint/crypto-utils";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { eq } from "drizzle-orm";

import {
  createOtpCode,
  createUsers,
  deleteOtpCodes,
  deleteUsers,
  findOneOtpCode,
  findOneUser,
  updateOtpCodes,
  updateUsers,
  users,
} from "../../../db";
import { generateRegistrationToken } from "../../../shared/utils/jwt";
import type { MockUser } from "../../../tests/mock-data/users/types";
import { agent, testDb } from "../../../tests/setup";
import {
  createUser,
  deleteUserAccount,
  getUser,
  updateUser,
  updateUserPhone,
} from "../service";

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

    test("creates a new user from a valid registration token and returns auth tokens", async () => {
      const phone = "+5511988888888";
      const { registrationToken } = await generateRegistrationToken({ phone });

      const result = await createUser({
        registrationToken,
        firstName: "John",
        lastName: "Doe",
      });

      createdUserIds.push(result.user.id);

      expect(result.user).toMatchObject({
        firstName: "John",
        lastName: "Doe",
        role: "user",
      });
      expect(result.user.id).toBeString();
      expect(result.accessToken).toBeString();
      expect(result.refreshToken).toBeString();
      expect(result.accessTokenExpiresIn).toBeNumber();
      expect(result.refreshTokenExpiresIn).toBeNumber();

      const createdRow = await findOneUser({
        where: { id: result.user.id },
        require: false,
      });
      expect(createdRow).not.toBeNull();
      expect(createdRow!.phone).toBe(phone);
      expect(createdRow!.phoneVerified).toBe(true);
    });

    test("throws UnauthorizedError when registration token is malformed", async () => {
      await expect(
        createUser({
          registrationToken: "not-a-valid-token",
          firstName: "John",
          lastName: "Doe",
        }),
      ).rejects.toThrow("Invalid or expired registration token");
    });

    test("throws UnauthorizedError when registration token is expired", async () => {
      const jws = await import("../../../shared/utils/jws");
      const { env } = await import("../../../config");
      const phone = "+5511987777777";

      const { token } = await jws.generateToken(
        phone,
        "registration",
        -1,
        env.JWT_SECRET.release(),
      );

      await expect(
        createUser({
          registrationToken: token,
          firstName: "John",
          lastName: "Doe",
        }),
      ).rejects.toThrow("Invalid or expired registration token");
    });

    test("throws ConflictError when the phone is already registered", async () => {
      const { registrationToken } = await generateRegistrationToken({
        phone: primaryUser.phone,
      });

      await expect(
        createUser({
          registrationToken,
          firstName: "Jane",
          lastName: "Smith",
        }),
      ).rejects.toThrow("A user with this phone number already exists");
    });
  });

  describe("updateUser", () => {
    afterEach(async () => {
      await deleteUsers({ where: { id: primaryUser.id } });
      await agent.seed({ users: ["carlosSilvaAB"] });
    });

    test("updates a single field", async () => {
      const result = await updateUser({
        userId: primaryUser.id,
        body: { firstName: "Updated" },
      });

      expect(result.firstName).toBe("Updated");
      expect(result.lastName).toBe(primaryUser.lastName);
    });

    test("updates all allowed fields together", async () => {
      const result = await updateUser({
        userId: primaryUser.id,
        body: { firstName: "Updated", lastName: "Name" },
      });

      expect(result).toMatchObject({
        firstName: "Updated",
        lastName: "Name",
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

    test("throws NotFoundError when the user does not exist", async () => {
      await expect(
        updateUser({
          userId: "00000000-0000-0000-0000-000000000000",
          body: { firstName: "Ghost" },
        }),
      ).rejects.toThrow("Could not find the user to update!");
    });
  });

  describe("deleteUserAccount", () => {
    test("permanently deletes user from database", async () => {
      const before = await findOneUser({ where: { id: primaryUser.id } });
      expect(before).toBeDefined();

      await deleteUserAccount(primaryUser.id);

      const after = await testDb.query.users.findFirst({
        where: eq(users.id, primaryUser.id),
      });
      expect(after).toBeUndefined();

      // Restore the user so other tests in this file can rely on it.
      await createUsers({
        data: [
          {
            id: before.id,
            email: before.email,
            firstName: before.firstName,
            lastName: before.lastName,
            phone: before.phone,
            phoneVerified: before.phoneVerified,
            role: before.role,
            otpRequestedAt: before.otpRequestedAt,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
    });
  });

  describe("getUser", () => {
    let anaCostaAdmin: MockUser;
    let otherUser: MockUser;

    beforeAll(async () => {
      await agent.seed({ users: ["anaCostaAdmin", "mariaSantosB"] });
      anaCostaAdmin = agent.getFixture({ user: "anaCostaAdmin" });
      otherUser = agent.getFixture({ user: "mariaSantosB" });
    });

    afterAll(async () => {
      await deleteUsers({
        where: {
          id: { operator: "in", value: [anaCostaAdmin.id, otherUser.id] },
        },
      });
    });

    test("returns the caller's full user record when the caller is the owner", async () => {
      const dbUser = await findOneUser({ where: { id: primaryUser.id } });

      const result = await getUser({
        userId: primaryUser.id,
        authUser: {
          id: primaryUser.id,
          email: primaryUser.email,
          firstName: primaryUser.firstName,
          lastName: primaryUser.lastName,
          role: primaryUser.role,
        },
      });

      expect(result).toMatchObject({
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role,
        phone: dbUser.phone,
      });
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    test("returns the requested user record when the caller is an admin", async () => {
      const result = await getUser({
        userId: primaryUser.id,
        authUser: {
          id: anaCostaAdmin.id,
          email: anaCostaAdmin.email,
          firstName: anaCostaAdmin.firstName,
          lastName: anaCostaAdmin.lastName,
          role: anaCostaAdmin.role,
        },
      });

      expect(result.id).toBe(primaryUser.id);
      expect(result.email).toBe(primaryUser.email);
    });

    test("throws ForbiddenError when caller is not the owner and not an admin", async () => {
      await expect(
        getUser({
          userId: primaryUser.id,
          authUser: {
            id: otherUser.id,
            email: otherUser.email,
            firstName: otherUser.firstName,
            lastName: otherUser.lastName,
            role: otherUser.role,
          },
        }),
      ).rejects.toThrow(/Access denied/);
    });

    test("throws NotFoundError when the requested user does not exist", async () => {
      await expect(
        getUser({
          userId: "00000000-0000-0000-0000-000000000000",
          authUser: {
            id: anaCostaAdmin.id,
            email: anaCostaAdmin.email,
            firstName: anaCostaAdmin.firstName,
            lastName: anaCostaAdmin.lastName,
            role: anaCostaAdmin.role,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe("updateUserPhone", () => {
    let conflictUser: MockUser;

    const KNOWN_CODE = "313131";
    const KNOWN_REQUEST_TOKEN = "ab".repeat(32);

    /** Phones used in these tests — cleaned up in afterAll. */
    const createdPhones: string[] = [];

    beforeAll(async () => {
      await agent.seed({ users: ["joaoOliveiraBCD"] });
      conflictUser = agent.getFixture({ user: "joaoOliveiraBCD" });
    });

    afterAll(async () => {
      await updateUsers({
        where: { id: primaryUser.id },
        values: {
          phone: primaryUser.phone,
          phoneVerified: true,
        },
      });
      await Promise.all(
        createdPhones.map((phone) =>
          deleteOtpCodes({ where: { phone } }).catch(() => {}),
        ),
      );
      await deleteUsers({ where: { id: conflictUser.id } });
    });

    /**
     * Seeds an OTP record for a phone with known plaintext code and token.
     * @param phone - The phone number to seed.
     */
    async function seedOtp(phone: string): Promise<void> {
      createdPhones.push(phone);
      await createOtpCode({
        data: {
          phone,
          code: hashSha256(KNOWN_CODE),
          requestToken: hashSha256(KNOWN_REQUEST_TOKEN),
          expiresAt: new Date(Date.now() + 300_000),
        },
        onConflictDoUpdate: {
          target: "phone",
          set: {
            code: hashSha256(KNOWN_CODE),
            requestToken: hashSha256(KNOWN_REQUEST_TOKEN),
            expiresAt: new Date(Date.now() + 300_000),
            attempts: 0,
          },
        },
      });
    }

    test("updates phone, marks it verified, and consumes the OTP", async () => {
      const before = await findOneUser({ where: { id: primaryUser.id } });
      const newPhone = "+5511955550001";
      await seedOtp(newPhone);

      const result = await updateUserPhone({
        userId: primaryUser.id,
        body: {
          phone: newPhone,
          code: KNOWN_CODE,
          requestToken: KNOWN_REQUEST_TOKEN,
        },
      });

      expect(result).toMatchObject({
        id: primaryUser.id,
        phone: newPhone,
        phoneVerified: true,
      });

      const otp = await findOneOtpCode({
        where: { phone: newPhone },
        require: false,
      });
      expect(otp).toBeNull();

      await updateUsers({
        where: { id: primaryUser.id },
        values: { phone: before.phone, phoneVerified: before.phoneVerified },
      });
    });

    test("rejects when the phone already belongs to another user", async () => {
      await expect(
        updateUserPhone({
          userId: primaryUser.id,
          body: {
            phone: conflictUser.phone,
            code: KNOWN_CODE,
            requestToken: KNOWN_REQUEST_TOKEN,
          },
        }),
      ).rejects.toThrow(/already exists/i);
    });

    test("rejects when no active OTP exists for the new phone", async () => {
      const newPhone = "+5511955550002";

      await expect(
        updateUserPhone({
          userId: primaryUser.id,
          body: {
            phone: newPhone,
            code: KNOWN_CODE,
            requestToken: KNOWN_REQUEST_TOKEN,
          },
        }),
      ).rejects.toThrow(/No valid OTP found/);
    });

    test("rejects when OTP attempts have been exhausted", async () => {
      const newPhone = "+5511955550003";
      await seedOtp(newPhone);
      await updateOtpCodes({
        where: { phone: newPhone },
        values: { attempts: 3 },
      });

      await expect(
        updateUserPhone({
          userId: primaryUser.id,
          body: {
            phone: newPhone,
            code: KNOWN_CODE,
            requestToken: KNOWN_REQUEST_TOKEN,
          },
        }),
      ).rejects.toThrow(/Maximum verification attempts/i);
    });

    test("rejects with INVALID_REQUEST_TOKEN when token is wrong", async () => {
      const newPhone = "+5511955550004";
      await seedOtp(newPhone);

      await expect(
        updateUserPhone({
          userId: primaryUser.id,
          body: {
            phone: newPhone,
            code: KNOWN_CODE,
            requestToken: "cd".repeat(32),
          },
        }),
      ).rejects.toThrow(/Invalid request token/);

      const after = await findOneUser({ where: { id: primaryUser.id } });
      expect(after.phone).toBe(primaryUser.phone);
    });

    test("rejects with INVALID_OTP when code is wrong, and phone is not changed", async () => {
      const newPhone = "+5511955550005";
      await seedOtp(newPhone);

      await expect(
        updateUserPhone({
          userId: primaryUser.id,
          body: {
            phone: newPhone,
            code: "999999",
            requestToken: KNOWN_REQUEST_TOKEN,
          },
        }),
      ).rejects.toThrow(/Invalid verification code/);

      const after = await findOneUser({ where: { id: primaryUser.id } });
      expect(after.phone).toBe(primaryUser.phone);
    });
  });
});
