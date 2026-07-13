import { ISO_DATE_PATTERN as ISO_DATE_PATTERN_STR } from "@blueprint/date-utils";
import { FormatRegistry } from "@sinclair/typebox";

/**
 * Side-effect module that registers the `format` validators referenced by
 * schemas in this package. TypeBox's `Value.Decode` rejects values whose
 * `format` is not in the registry with `Unknown format 'X'`, so any consumer
 * that pulls `@blueprint/api-utils` must populate the registry before
 * decoding API responses. Importing this from `index.ts` ensures it runs once
 * per process the first time the package is loaded.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_DATE_PATTERN = new RegExp(ISO_DATE_PATTERN_STR);

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

if (!FormatRegistry.Has("uuid")) {
  FormatRegistry.Set("uuid", (value) => UUID_PATTERN.test(value));
}

if (!FormatRegistry.Has("date-time")) {
  FormatRegistry.Set("date-time", (value) => !Number.isNaN(Date.parse(value)));
}

if (!FormatRegistry.Has("email")) {
  FormatRegistry.Set("email", (value) => EMAIL_PATTERN.test(value));
}

if (!FormatRegistry.Has("date")) {
  FormatRegistry.Set(
    "date",
    (value) => ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value)),
  );
}
