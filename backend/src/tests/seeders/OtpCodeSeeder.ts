import { otpCodes } from "../../db";
import type { TestDatabase } from "../db";
import {
  defaults,
  fixtures,
  type OtpCodeFixtures,
} from "../mock-data/otpCodes/fixtures";
import { Seeder } from "./Seeder";

/** Seeder for the otp_codes table. */
export class OtpCodeSeeder extends Seeder<OtpCodeFixtures> {
  constructor(db: TestDatabase) {
    super(db);
  }

  /**
   * Seeds an OTP code fixture by name.
   * @param fixtureName - The name of the OTP code fixture to seed.
   * @returns The fixture data.
   */
  async seed<K extends keyof OtpCodeFixtures>(
    fixtureName: K,
  ): Promise<OtpCodeFixtures[K]> {
    const fixture = fixtures[fixtureName];
    const merged = { ...defaults, ...fixture };
    await this.db.insert(otpCodes).values(merged);
    return fixture;
  }

  /** Clears all data from the otp_codes table. */
  async clear(): Promise<void> {
    await this.db.delete(otpCodes);
  }
}
