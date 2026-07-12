import { testDb } from "./preload";
import { TestAgent } from "./TestAgent";

// Re-export testDb for test files that need direct database access
export { testDb };

/** Test agent instance for seeding and fixture retrieval. */
export const agent = new TestAgent(testDb);
