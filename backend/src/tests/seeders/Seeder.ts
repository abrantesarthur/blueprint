import type { TestDatabase } from "../db";

/**
 * Abstract base class for seeders.
 * Each seeder handles a specific table and its fixtures.
 */
export abstract class Seeder<TFixtures> {
  constructor(protected db: TestDatabase) {}

  /**
   * Seeds a fixture by name.
   * @param fixtureName - The name of the fixture to seed.
   * @returns The fixture data.
   */
  abstract seed<K extends keyof TFixtures>(
    fixtureName: K,
  ): Promise<TFixtures[K]>;

  /** Clears all data from the table. */
  abstract clear(): Promise<void>;
}
