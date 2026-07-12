import { NotFoundError } from "../../../shared/utils/errors";
import type { OtpCode } from "../../schema";
import { findOtpCodes } from "./findOtpCodes";
import type { FindOneOtpCodeOptions, OtpCodesInclude } from "./types";

/**
 * Finds an OTP code matching the provided filters.
 * @param options - The filter options.
 * @returns The OTP code if found, null otherwise.
 */
export async function findOneOtpCode<T extends OtpCodesInclude>(
  options: FindOneOtpCodeOptions<T> & { require: false },
): Promise<OtpCode | null>;

/**
 * Finds an OTP code matching the provided filters.
 * @param options - The filter options.
 * @returns The OTP code if found.
 * @throws NotFoundError if no OTP code matches.
 */
export async function findOneOtpCode<T extends OtpCodesInclude>(
  options: FindOneOtpCodeOptions<T> & { require?: true },
): Promise<OtpCode>;

/**
 * Finds an OTP code matching the provided filters.
 * @param options - The filter options.
 * @returns The OTP code if found (or throws by default if not found).
 */
export async function findOneOtpCode<T extends OtpCodesInclude>({
  attributes,
  where,
  include,
  orderBy,
  require = true,
  tx,
}: FindOneOtpCodeOptions<T> & {
  require?: boolean;
}): Promise<OtpCode | null> {
  const [otpCode] = await findOtpCodes({
    attributes,
    where,
    include,
    orderBy,
    limit: 1,
    offset: 0,
    tx,
  } as FindOneOtpCodeOptions<T>);

  if (!otpCode && require) {
    throw new NotFoundError("OTP code not found");
  }

  return otpCode ?? null;
}
