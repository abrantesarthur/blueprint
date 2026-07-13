# @blueprint/error-utils

Typed, client-facing error messages shared between backend and frontend, plus
the shared error code/type definitions.

- **One file per backend module** (e.g. `users.ts`), each exporting a
  `<Module>ErrorMessage` constant (the message strings services throw) and a
  `<Module>ErrorTranslation` map.
- `types.ts` — shared error codes, HTTP status mappings, and error shapes.

```ts
import { UserErrorMessage } from "@blueprint/error-utils";

throw new NotFoundError(UserErrorMessage.USER_NOT_FOUND);
```
