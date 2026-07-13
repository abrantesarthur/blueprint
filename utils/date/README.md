# @blueprint/date-utils

Pure helpers for computing and formatting calendar dates — no `Date` mutation,
no external date library.

- `addDays`, `getFutureDateStr`, `getPastDateStr`, `getTodayStr` — date arithmetic and `YYYY-MM-DD` strings.
- `getNextDayOfWeek` / `getNextDayOfWeekStr` — next occurrence of a weekday.
- `intervalsOverlap` — test whether two time intervals overlap.
- `toEpochMs` — convert to epoch milliseconds.
- `patterns` — shared date-string regex patterns.
