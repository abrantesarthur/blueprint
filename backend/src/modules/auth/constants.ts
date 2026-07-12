import { ONE_MINUTE, ONE_SECOND } from "@blueprint/time-utils";

// OTP Configuration
export const OTP_EXPIRY_MS = 5 * ONE_MINUTE;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RATE_LIMIT_MS = ONE_MINUTE;

/** Number of random bytes used to generate the OTP request token (yields 64-char hex string). */
export const REQUEST_TOKEN_BYTES = 32;

/** Registration token validity window after OTP verification (10 minutes, in seconds). */
export const REGISTRATION_TOKEN_EXPIRY = (10 * ONE_MINUTE) / ONE_SECOND;
