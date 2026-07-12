import type { OtpCode, otpCodes } from "../../schema";
import type {
  GenericCreateOptions,
  GenericDeleteOptions,
  GenericFindOneOptions,
  GenericFindOptions,
  GenericUpdateOptions,
} from "../utils/types";

/** Include options for finding OTP codes. */
export type OtpCodesInclude = [];

/** Options for creating a single OTP code record. */
export type CreateOtpCodeOptions = Omit<
  GenericCreateOptions<typeof otpCodes>,
  "data"
> & {
  /** The OTP code data to insert. */
  data: (typeof otpCodes)["$inferInsert"];
};

/** Filter options for finding OTP codes. */
export type FindOtpCodesOptions<
  T extends OtpCodesInclude,
  K extends keyof OtpCode = keyof OtpCode,
  A extends string = string,
  AK extends keyof OtpCode = keyof OtpCode,
> = GenericFindOptions<OtpCode, T, K, A, AK>;

/** Filter options for finding a single OTP code. */
export type FindOneOtpCodeOptions<T extends OtpCodesInclude> =
  GenericFindOneOptions<OtpCode, T, keyof OtpCode>;

/** Update options for OTP codes. */
export type UpdateOtpCodeOptions = GenericUpdateOptions<OtpCode>;

/** Delete options for OTP codes. */
export type DeleteOtpCodeOptions = GenericDeleteOptions<OtpCode>;
