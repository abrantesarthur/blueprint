import type { TestDatabase } from "./db";
import {
  fixtures as otpCodeFixtures,
  type OtpCodeFixtures,
} from "./mock-data/otpCodes/fixtures";
import type { MockOtpCode } from "./mock-data/otpCodes/types";
import {
  fixtures as userFixtures,
  type UserFixtures,
} from "./mock-data/users/fixtures";
import type { MockUser } from "./mock-data/users/types";
import { OtpCodeSeeder } from "./seeders/OtpCodeSeeder";
import { Seeder } from "./seeders/Seeder";
import { UserSeeder } from "./seeders/UserSeeder";

enum SeedEntity {
  Users = "users",
  OtpCodes = "otpCodes",
}

/** Specification for seeding fixtures. */
interface SeedSpec {
  /** User fixtures to seed. */
  [SeedEntity.Users]?: (keyof UserFixtures)[];
  /** OTP code fixtures to seed. */
  [SeedEntity.OtpCodes]?: (keyof OtpCodeFixtures)[];
}

/**
 * Type-safe Object.entries that preserves key types.
 * @param obj - The object to get the entries of.
 * @returns The entries of the object.
 */
function typedEntries<T extends object>(obj: T): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
}

/**
 * Central test utility class that encapsulates seeding and fixture retrieval.
 * Provides a clean API for test files to seed data and retrieve fixture instances.
 */
export class TestAgent {
  private seeders: {
    [SeedEntity.Users]: UserSeeder;
    [SeedEntity.OtpCodes]: OtpCodeSeeder;
  };
  private seededOrder: SeedEntity[] = [];

  constructor(db: TestDatabase) {
    this.seeders = {
      users: new UserSeeder(db),
      otpCodes: new OtpCodeSeeder(db),
    };
  }

  /**
   * Seeds fixtures in the order specified by the spec object properties.
   * PostgreSQL FK constraints will catch incorrect ordering.
   * @param spec - Object specifying which fixtures to seed for each entity.
   */
  async seed(spec: SeedSpec): Promise<void> {
    for (const [entity, names] of typedEntries(spec)) {
      if (!names || names.length === 0) continue;

      this.seededOrder.push(entity);

      // TypeScript can't correlate entity with names, but we know they match
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seeder = this.seeders[entity] as Seeder<any>;
      for (const name of names) {
        await seeder.seed(name);
      }
    }
  }

  /** Gets a user fixture by name. */
  getFixture(opts: { user: keyof UserFixtures }): MockUser;
  /** Gets an OTP code fixture by name. */
  getFixture(opts: { otpCode: keyof OtpCodeFixtures }): MockOtpCode;
  /**
   * Gets a fixture by entity type and name.
   * @param opts - Object with exactly one key specifying the entity type and fixture name.
   * @returns The fixture data.
   */
  getFixture(opts: {
    user?: keyof UserFixtures;
    otpCode?: keyof OtpCodeFixtures;
  }): MockUser | MockOtpCode {
    if (opts.user) return userFixtures[opts.user];
    if (opts.otpCode) return otpCodeFixtures[opts.otpCode];
    throw new Error("Must specify user or otpCode");
  }

  /** Clears seeded tables in reverse order of seeding. */
  async clear(): Promise<void> {
    for (const entity of [...this.seededOrder].reverse()) {
      await this.seeders[entity].clear();
    }
    this.seededOrder = [];
  }
}
