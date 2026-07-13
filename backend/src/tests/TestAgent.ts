import type { TestDatabase } from "./db";
import {
  fixtures as userFixtures,
  type UserFixtures,
} from "./mock-data/users/fixtures";
import type { MockUser } from "./mock-data/users/types";
import { Seeder } from "./seeders/Seeder";
import { UserSeeder } from "./seeders/UserSeeder";

enum SeedEntity {
  Users = "users",
}

/** Specification for seeding fixtures. */
interface SeedSpec {
  /** User fixtures to seed. */
  [SeedEntity.Users]?: (keyof UserFixtures)[];
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
  };
  private seededOrder: SeedEntity[] = [];

  constructor(db: TestDatabase) {
    this.seeders = {
      users: new UserSeeder(db),
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

  /**
   * Gets a fixture by entity type and name.
   * @param opts - Object specifying the entity type and fixture name.
   * @returns The fixture data.
   */
  getFixture(opts: {
    /** The user fixture name. */
    user: keyof UserFixtures;
  }): MockUser {
    return userFixtures[opts.user];
  }

  /** Clears seeded tables in reverse order of seeding. */
  async clear(): Promise<void> {
    for (const entity of [...this.seededOrder].reverse()) {
      await this.seeders[entity].clear();
    }
    this.seededOrder = [];
  }
}
