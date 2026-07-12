/**
 * Ambient declarations for the `@bitwarden/sdk-wasm` internals we drive directly.
 *
 * The package ships a combined CJS entry that loads its `.wasm` from disk via
 * `fs.readFileSync(__dirname)`, which `bun build --compile` cannot embed. We
 * instead import the raw wasm-bindgen glue (`bitwarden_wasm_bg.js`) and the wasm
 * asset and initialize them by hand so the binary is self-contained. Neither
 * subpath ships usable types, so they are declared here.
 */

declare module "@bitwarden/sdk-wasm/bitwarden_wasm_bg.js" {
  /** Low-level wasm-bindgen client wrapping the Rust Secrets Manager SDK. */
  export class BitwardenClient {
    /**
     * @param settings - JSON-encoded client settings (empty object → defaults).
     * @param logLevel - Numeric {@link LogLevel} value.
     */
    constructor(settings?: string, logLevel?: number);
    /**
     * Runs a JSON-encoded SDK command.
     * @param input - The JSON-encoded command.
     * @returns The JSON command response as a plain object.
     */
    run_command(input: string): Promise<unknown>;
    /** Releases the wasm-side memory held by this client. */
    free(): void;
  }

  /** wasm-bindgen log-level enum (`Error` = 4). */
  export const LogLevel: Readonly<Record<string, number>>;

  /**
   * Binds the instantiated wasm exports into the glue module. Must be called
   * once, before constructing {@link BitwardenClient}.
   * @param wasm - The instantiated `WebAssembly.Instance` exports.
   */
  export function __wbg_set_wasm(wasm: unknown): void;
}

declare module "@bitwarden/sdk-wasm/bitwarden_wasm_bg.wasm" {
  /** Embedded asset path, resolved by Bun's `with { type: "file" }` loader. */
  const path: string;
  export default path;
}
