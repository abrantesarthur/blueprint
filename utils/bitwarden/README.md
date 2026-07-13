# @blueprint/bitwarden-utils

Thin wrapper around the embedded Bitwarden Secrets Manager WASM SDK. Fetches
secrets in-process — no `bws` CLI install required. Used by
[`@blueprint/async-arg-utils`](../async-arg) to resolve `bwsName` arguments.

Requires `BWS_ACCESS_TOKEN` and `BWS_ORGANIZATION_ID` (machine-account
credentials) in the environment.

```ts
import { createBitwardenClient } from "@blueprint/bitwarden-utils";

const client = await createBitwardenClient();
const secret = await client.getSecretByName("MY_SECRET");
```
