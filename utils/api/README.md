# @blueprint/api-utils

Shared API contract between the frontend and backend. Any TypeBox schema or
type that describes a request input or response output used by **both** sides
lives here, so the two stay in sync from a single source of truth.

- **One file per backend module** (e.g. `users.ts`) holding its request/response schemas.
- `regex.ts` — shared validation patterns.
- `pagination.ts` — shared pagination query/response shapes.
- `registerFormats.ts` — registers custom TypeBox string formats (imported for side effects).
- `utils/nullable.ts` — helper for nullable schema fields.

```ts
import { userResponse, type UserResponse } from "@blueprint/api-utils";
```
