/** Explicitly defined fields we care about in OTP code fixtures. */
export interface MockOtpCode {
  /** Unique identifier. */
  id: string;
  /** Phone number. */
  phone: string;
  /** Hashed OTP code. */
  code: string;
  /** Hashed request token. */
  requestToken: string;
  /** Expiration date. */
  expiresAt: Date;
  /** Number of verification attempts. */
  attempts: number;
}
