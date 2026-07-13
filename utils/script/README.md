# @blueprint/script-utils

Helpers for writing CLI/dev scripts (used by `backend/src/scripts/*`): run
commands, show spinners, and log success/failure consistently.

- `exec` / `execStart` — run shell commands (awaited result vs. long-running start).
- `promiseSpinner` — wrap a promise with an `ora` spinner.
- `logSuccess` / `logFailure` — consistent success/failure output.
