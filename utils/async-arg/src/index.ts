import { booleanArg, numberArg, stringArg } from "./argTypes";
import { cleanup } from "./fetchers";

const AsyncArg = {
  number: numberArg,
  string: stringArg,
  boolean: booleanArg,
  /**
   * Clears all fetcher caches. Call after loading all required config
   * to avoid keeping unnecessary data in memory.
   */
  cleanup,
};

export default AsyncArg;
