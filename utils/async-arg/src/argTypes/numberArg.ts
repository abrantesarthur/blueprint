import { AsyncArg, type AsyncArgInput } from "../AsyncArg";

/** Validation options for number arguments. */
interface NumberValidation {
  /** Minimum value for the number. */
  min?: number;
  /** Maximum value for the number. */
  max?: number;
}

/**
 * Input options for creating a number AsyncArg with validation.
 * @template Sensitive - Whether the value should be wrapped in Secret<number>
 */
type NumberArgInput<Sensitive extends boolean = false> = AsyncArgInput<
  number,
  Sensitive
> &
  NumberValidation;

/**
 * Creates a number AsyncArg with optional validation.
 * @template Sensitive - Whether the value should be wrapped in Secret<number>
 * @param options - Configuration options for the argument including validation
 * @returns An AsyncArg that parses values as numbers
 */
export const numberArg = <Sensitive extends boolean = false>(
  options: NumberArgInput<Sensitive>,
): AsyncArg<number, Sensitive, AsyncArgInput<number, Sensitive>> =>
  new AsyncArg(options, (value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new Error(`Cannot parse "${value}" as number`);
    }
    if (options.min !== undefined && parsed < options.min) {
      throw new Error(`must be at least ${options.min}`);
    }
    if (options.max !== undefined && parsed > options.max) {
      throw new Error(`must be at most ${options.max}`);
    }
    return parsed;
  });
