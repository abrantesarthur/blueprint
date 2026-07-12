import { type Static, Type as t } from "@sinclair/typebox";

/** Offset-based pagination query parameters. */
export const offsetPaginationQuery = t.Object({
  /** Maximum number of records to return (1-100, default 20). */
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
  /** Number of records to skip (default 0). */
  offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
});

/** Offset-based pagination response fields. */
export const offsetPaginationResponse = t.Object({
  /** Total number of records available. */
  total: t.Number(),
  /** Maximum number of records returned in this page. */
  limit: t.Number(),
  /** Number of records skipped before this page. */
  offset: t.Number(),
});

/** Sort order: ascending or descending. */
export const sortOrder = t.Union([t.Literal("asc"), t.Literal("desc")]);

/** Offset-based pagination query parameters type. */
export type OffsetPaginationQuery = Static<typeof offsetPaginationQuery>;
/** Offset-based pagination response fields type. */
export type OffsetPaginationResponse = Static<typeof offsetPaginationResponse>;
/** Sort order type. */
export type SortOrder = Static<typeof sortOrder>;
