# @blueprint/time-utils

Time-duration constants (in milliseconds) and small time helpers, so durations
read as named values instead of magic numbers.

- `constants` — `ONE_MS`, `ONE_SECOND`, `ONE_MINUTE`, `ONE_HOUR`, `ONE_DAY`, `ONE_WEEK`.
- `sleep` — promise-based delay.
- `ttl` — time-to-live / expiry helpers.

```ts
import { ONE_HOUR, ONE_MINUTE } from "@blueprint/time-utils";

const CACHE_TTL = 2 * ONE_HOUR;
const TIMEOUT = 30 * ONE_MINUTE;
```
