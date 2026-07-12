import type { Table } from "drizzle-orm";

import type { IncludeOption } from "./types";

/**
 * Recursively flattens a nested include tree into a flat list of
 * table/attributes/alias triples for column selection.
 * @param include - The nested include array.
 * @returns Flat array of { table, attributes, alias } objects.
 */
export function flattenInclude(include: IncludeOption<Table>[] | undefined): {
  table: Table;
  attributes?: string[];
  alias?: Table;
  required?: boolean;
}[] {
  if (!include) return [];
  const result: {
    table: Table;
    attributes?: string[];
    alias?: Table;
    required?: boolean;
  }[] = [];
  for (const item of include) {
    result.push({
      table: item.table,
      attributes: item.attributes as string[] | undefined,
      alias: item.alias as Table | undefined,
      required: item.required,
    });
    if (item.include) {
      result.push(...flattenInclude(item.include));
    }
  }
  return result;
}
