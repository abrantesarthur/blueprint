import { Secret } from "@transcend-io/secret-value";

import { bwsFetcher, envFetcher, type Fetcher } from "./fetchers";

/**
 * Base options shared by all AsyncArg inputs.
 * @template T - The type of the argument value
 * @template Sensitive - Whether the value should be wrapped in Secret<T>
 */
interface BaseAsyncArgInput<T, Sensitive extends boolean = false> {
  /** Description of what this argument is used for. */
  description: string;
  /** Optional default value if fetch fails or returns undefined. */
  default?: T;
  /** If true, wraps the value in Secret<T> to prevent accidental logging. */
  sensitive?: Sensitive;
}

/**
 * Options for an AsyncArg fetched from environment variables.
 * @template T - The type of the argument value
 * @template Sensitive - Whether the value should be wrapped in Secret<T>
 */
interface EnvAsyncArgInput<T, Sensitive extends boolean = false>
  extends BaseAsyncArgInput<T, Sensitive> {
  /** The environment variable name to fetch from. */
  envName: string;
  /** Bitwarden secret name. Must be `never` when `envName` is specified. */
  bwsName?: never;
}

/**
 * Options for an AsyncArg fetched from Bitwarden secrets.
 * @template T - The type of the argument value
 * @template Sensitive - Whether the value should be wrapped in Secret<T>
 */
interface BwsAsyncArgInput<T, Sensitive extends boolean = false>
  extends BaseAsyncArgInput<T, Sensitive> {
  /** The Bitwarden secret name to fetch from. */
  bwsName: string;
  /** Environment variable name. Must be `never` when `bwsName` is specified. */
  envName?: never;
}

/**
 * Input options for creating an AsyncArg.
 * Must specify either envName or bwsName, but not both.
 * @template T - The type of the argument value
 * @template Sensitive - Whether the value should be wrapped in Secret<T>
 */
export type AsyncArgInput<T = unknown, Sensitive extends boolean = false> =
  | EnvAsyncArgInput<T, Sensitive>
  | BwsAsyncArgInput<T, Sensitive>;

/**
 * The result type of fetch(), either T or Secret<T> based on the sensitive option.
 * @template T - The type of the argument value
 * @template Sensitive - Whether the value should be wrapped in Secret<T>
 */
type FetchResult<T, Sensitive extends boolean> = Sensitive extends true
  ? Secret<T>
  : T;

/**
 * Represents an asynchronous argument that can be fetched from a source.
 * @template T - The type of the parsed value
 * @template Sensitive - Whether the value should be wrapped in Secret<T>
 * @template O - The options type used to configure this argument
 */
export class AsyncArg<
  T,
  Sensitive extends boolean,
  O extends AsyncArgInput<T, Sensitive>,
> {
  private readonly parser: (value: string) => T;
  private readonly fetcher: Fetcher;
  private readonly fetcherName: string;
  private readonly name: string;
  private readonly description: string;
  private readonly defaultValue?: T;
  private readonly sensitive: boolean;

  /**
   * Creates a new AsyncArg instance.
   * @param options - Configuration options including source name
   * @param parser - Function to parse the raw string value into type T
   */
  constructor(options: O, parser: (value: string) => T) {
    this.parser = parser;
    this.description = options.description;
    this.defaultValue = options.default;
    this.sensitive = options.sensitive ?? false;

    if ("envName" in options && options.envName) {
      this.fetcher = envFetcher;
      this.fetcherName = "environment";
      this.name = options.envName;
    } else if ("bwsName" in options && options.bwsName) {
      this.fetcher = bwsFetcher;
      this.fetcherName = "Bitwarden";
      this.name = options.bwsName;
    } else {
      throw new Error("Must specify either envName or bwsName");
    }
  }

  /**
   * Fetches and parses the argument value from the configured source.
   * @returns The parsed value (or Secret<T> if sensitive), or the default value if fetch fails
   * @throws Error if the value cannot be fetched and no default is provided
   */
  async fetch(): Promise<FetchResult<T, Sensitive>> {
    const raw = await this.fetcher.fetch(this.name);

    let value: T;
    if (raw === undefined) {
      if (this.defaultValue !== undefined) {
        value = this.defaultValue;
      } else {
        throw new Error(
          `Failed to fetch ${this.name} (${this.description}) from ${this.fetcherName}.`,
        );
      }
    } else {
      try {
        value = this.parser(raw);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to fetch ${this.name} (${this.description}): ${message}`,
        );
      }
    }

    if (this.sensitive) {
      return new Secret(value) as FetchResult<T, Sensitive>;
    }
    return value as FetchResult<T, Sensitive>;
  }
}
