import type { RequiredKeys } from "@blueprint/type-utils";

import type { NewOtpCode } from "../../../db";
import { fixtures as userFixtures } from "../users/fixtures";
import type { MockOtpCode } from "./types";

/** Default values merged with fixtures before seeding. */
export const defaults: Omit<NewOtpCode, RequiredKeys<MockOtpCode>> = {};

/** Interface defining available OTP code fixture names. */
export interface OtpCodeFixtures {
  /** OTP code A - 0 attempts, expires 2099-01-01. Uses pedroOliveira phone. */
  otpCodeA: MockOtpCode;
  /** OTP code B - 3 attempts, expires 2099-06-01. Uses anaCostaAdmin phone. */
  otpCodeB: MockOtpCode;
  /** OTP code C - 0 attempts, expires 2099-01-01. Uses carlosSilvaAB phone. */
  otpCodeC: MockOtpCode;
  /** OTP code D - 1 attempt, expires 2099-03-01. Uses mariaSantosB phone. */
  otpCodeD: MockOtpCode;
  /** Expired OTP code - 0 attempts, expired 2020-01-01. Uses lucasFerreiraAdmin phone. */
  expiredOtpCode: MockOtpCode;
}

/** OTP code fixtures for testing. */
export const fixtures: OtpCodeFixtures = {
  otpCodeA: {
    id: "660e8400-e29b-41d4-a716-446655440001",
    phone: userFixtures.pedroOliveira.phone,
    code: "hashed-code-a",
    requestToken: "ab".repeat(32),
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    attempts: 0,
  },
  otpCodeB: {
    id: "660e8400-e29b-41d4-a716-446655440002",
    phone: userFixtures.anaCostaAdmin.phone,
    code: "hashed-code-b",
    requestToken: "ab".repeat(32),
    expiresAt: new Date("2099-06-01T00:00:00.000Z"),
    attempts: 3,
  },
  otpCodeC: {
    id: "660e8400-e29b-41d4-a716-446655440003",
    phone: userFixtures.carlosSilvaAB.phone,
    code: "hashed-code-c",
    requestToken: "ab".repeat(32),
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    attempts: 0,
  },
  otpCodeD: {
    id: "660e8400-e29b-41d4-a716-446655440004",
    phone: userFixtures.mariaSantosB.phone,
    code: "hashed-code-d",
    requestToken: "ab".repeat(32),
    expiresAt: new Date("2099-03-01T00:00:00.000Z"),
    attempts: 1,
  },
  expiredOtpCode: {
    id: "660e8400-e29b-41d4-a716-446655440005",
    phone: userFixtures.lucasFerreiraAdmin.phone,
    code: "hashed-code-expired",
    requestToken: "ab".repeat(32),
    expiresAt: new Date("2020-01-01T00:00:00.000Z"),
    attempts: 0,
  },
};
