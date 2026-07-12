import * as glue from "@bitwarden/sdk-wasm/bitwarden_wasm_bg.js";
import wasmPath from "@bitwarden/sdk-wasm/bitwarden_wasm_bg.wasm" with { type: "file" };

/** The wasm-bindgen glue module, once its wasm exports have been bound. */
export type BitwardenWasm = typeof glue;

/** Memoized init so the ~2 MB wasm module instantiates once per process. */
let initialized: Promise<BitwardenWasm> | undefined;

/**
 * Reads the embedded wasm asset, instantiates it, and binds it into the glue.
 * @returns The initialized glue module.
 */
async function initWasm(): Promise<BitwardenWasm> {
  const bytes = await Bun.file(wasmPath).arrayBuffer();
  // The glue module IS the import object the wasm expects (dozens of __wbg_*
  // trampolines). Its shape isn't worth modelling, so treat it as an opaque
  // import map at this untyped wasm-bindgen boundary.
  const imports: Bun.WebAssembly.Imports = {
    "./bitwarden_wasm_bg.js": glue as unknown as Bun.WebAssembly.ModuleImports,
  };
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  glue.__wbg_set_wasm(instance.exports);
  return glue;
}

/**
 * Lazily initializes the Bitwarden wasm SDK, embedded in the binary so it works
 * under `bun build --compile` with no `.wasm` on disk.
 * @returns The initialized glue module exposing `BitwardenClient` and `LogLevel`.
 */
export function getBitwardenWasm(): Promise<BitwardenWasm> {
  return (initialized ??= initWasm());
}
