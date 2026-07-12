import { users } from "../../db";
import type { TestDatabase } from "../db";
import {
  defaults,
  fixtures,
  type UserFixtures,
} from "../mock-data/users/fixtures";
import { Seeder } from "./Seeder";

/** Seeder for the users table. */
export class UserSeeder extends Seeder<UserFixtures> {
  constructor(db: TestDatabase) {
    super(db);
  }

  /**
   * Seeds a user fixture by name.
   * @param fixtureName - The name of the user fixture to seed.
   * @returns The fixture data.
   */
  async seed<K extends keyof UserFixtures>(
    fixtureName: K,
  ): Promise<UserFixtures[K]> {
    const fixture = fixtures[fixtureName];
    const merged = { ...defaults, ...fixture };
    await this.db.insert(users).values(merged);
    return fixture;
  }

  /** Clears all data from the users table. */
  async clear(): Promise<void> {
    await this.db.delete(users);
  }
}
