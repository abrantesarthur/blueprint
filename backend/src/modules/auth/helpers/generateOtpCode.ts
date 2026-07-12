/**
 * Generates a cryptographically secure 6-digit OTP code.
 * @returns A 6-digit string code.
 */
export function generateOtpCode(): string {
  let code: number;
  do {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    code = array[0]!;
  } while (code >= 4294000000); // Largest multiple of 1000000 below 2^32
  return (code % 1000000).toString().padStart(6, "0");
}
