import { AsyncArg, type AsyncArgInput } from "../AsyncArg";

/** Validation options for string arguments. */
interface StringValidation {
  /** Minimum length for the string value. */
  minLength?: number;
  /** Maximum length for the string value. */
  maxLength?: number;
  /** Regular expression pattern the value must match. */
  pattern?: RegExp;
}

/**
 * Input options for creating a string AsyncArg with validation.
 * @template Sensitive - Whether the value should be wrapped in Secret<string>
 */
type StringArgInput<Sensitive extends boolean = false> = AsyncArgInput<
  string,
  Sensitive
> &
  StringValidation;

/**
 * Creates a string AsyncArg with optional validation.
 * @template Sensitive - Whether the value should be wrapped in Secret<string>
 * @param options - Configuration options for the argument including validation
 * @returns An AsyncArg that returns values as strings
 */
export const stringArg = <Sensitive extends boolean = false>(
  options: StringArgInput<Sensitive>,
): AsyncArg<string, Sensitive, AsyncArgInput<string, Sensitive>> =>
  new AsyncArg(options, (value) => {
    if (options.minLength !== undefined && value.length < options.minLength) {
      throw new Error(`must be at least ${options.minLength} characters`);
    }
    if (options.maxLength !== undefined && value.length > options.maxLength) {
      throw new Error(`must be at most ${options.maxLength} characters`);
    }
    if (options.pattern !== undefined && !options.pattern.test(value)) {
      throw new Error(`must match pattern ${options.pattern}`);
    }
    return value;
  });
