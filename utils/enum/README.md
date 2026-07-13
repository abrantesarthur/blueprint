# @blueprint/enum-utils

Single source of truth for enums shared across the stack. Define an enum once as
a TypeBox `Union` of literals, then derive both the TypeScript type (via
`Static`) and the value tuple for Drizzle `pgEnum` (via `getSchemaValues`) — so
validation, types, and the database column can never drift apart.

```ts
import { type Static, Type as t } from "@sinclair/typebox";
import { getSchemaValues } from "@blueprint/enum-utils";

export const statusSchema = t.Union([
  t.Literal("active"),
  t.Literal("archived"),
]);
export type Status = Static<typeof statusSchema>;
export const STATUS_VALUES = getSchemaValues(statusSchema); // for pgEnum
```

Ships with an `exampleStatus` enum as a template — replace it with your own.
