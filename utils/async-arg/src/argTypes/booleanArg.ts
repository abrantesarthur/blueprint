import { AsyncArg, type AsyncArgInput } from "../AsyncArg";

/**
 * Parses a string value to boolean.
 * @param value - The string value to parse ("true" or "false", case-insensitive)
 * @returns The parsed boolean
 * @throws Error if the value is not "true" or "false"
 */
const parseBoolean = (value: string): boolean => {
  const normalized = value.toLowerCase().trim();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  throw new Error(`Cannot parse "${value}" as boolean`);
};

/**
 * Creates a boolean AsyncArg.
 * @template Sensitive - Whether the value should be wrapped in Secret<boolean>
 * @param options - Configuration options for the argument
 * @returns An AsyncArg that parses values as booleans
 */
export const booleanArg = <Sensitive extends boolean = false>(
  options: AsyncArgInput<boolean, Sensitive>,
): AsyncArg<boolean, Sensitive, AsyncArgInput<boolean, Sensitive>> =>
  new AsyncArg(options, parseBoolean);
