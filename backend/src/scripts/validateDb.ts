/**
 * Database Schema Validation Script
 *
 * Validates the Drizzle ORM schema for consistency and correctness.
 * Run with: bun db:validate
 */

import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  createTableRelationsHelpers,
  getTableColumns,
  getTableName,
  isTable,
  type Table,
} from "drizzle-orm";
import { getTableConfig, type PgColumn } from "drizzle-orm/pg-core";

import * as schema from "../db/schema";

/** Generic table type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = Table<any>;

/** Drizzle relations object type. */
interface DrizzleRelations {
  /** The source table for these relations. */
  table: AnyTable;
  /** Function that returns relation configuration when called with helpers. */
  config: (helpers: ReturnType<typeof createTableRelationsHelpers>) => Record<
    string,
    {
      referencedTableName: string;
      fieldName: string;
      sourceTable: AnyTable;
      referencedTable: AnyTable;
      /** Disambiguation label when multiple relations connect the same two tables. */
      relationName?: string;
      config?: {
        fields?: PgColumn[];
        references?: PgColumn[];
      };
      constructor?: { name: string };
    }
  >;
}

// ============================================================================
// Type Definitions
// ============================================================================

/** Validation error returned by validators. */
interface ValidationError {
  /** Name of the validator that produced this error. */
  validator: string;
  /** Human-readable description of the validation failure. */
  message: string;
  /** File path where the error was found. */
  file: string;
}

/** Information about a table column. */
interface ColumnInfo {
  /** Column name in the schema. */
  name: string;
  /** SQL data type of the column (e.g., "uuid", "text", "integer"). */
  sqlType: string;
  /** Whether this column is a primary key. */
  isPrimaryKey: boolean;
  /** Whether this column uses an enum type. */
  isEnum: boolean;
  /** Foreign key reference information, if applicable. */
  references?: {
    table: string;
    column: string;
    columnSqlType: string;
    onDelete?: string;
  };
}

/** Information about an index. */
interface IndexInfo {
  /** Name of the index. */
  name: string;
}

/** Information about a table. */
interface TableInfo {
  /** File path where the table is defined. */
  file: string;
  /** SQL table name (snake_case). */
  sqlTableName: string;
  /** Raw Drizzle table object. */
  rawTable: AnyTable;
  /** Information about all columns in the table. */
  columns: ColumnInfo[];
  /** Information about all indexes on the table. */
  indexes: IndexInfo[];
  /** Check constraints defined on the table. */
  checkConstraints: { name: string }[];
  /** Whether the table uses the timestamps helper. */
  usesTimestamps: boolean;
  /** Type names exported from this table's file. */
  exportedTypes: string[];
  /** JSDoc tags found on the table definition. */
  jsDocTags: string[];
  /** Checks if a specific JSDoc tag is present on the table. */
  hasJsDocTag: (tag: string) => boolean;
}

/** Information about a relation. */
interface RelationInfo {
  /** Name of the relation (used in queries). */
  name: string;
  /** Type of relation: "one" for belongsTo, "many" for hasMany. */
  type: "one" | "many";
  /** Name of the related table. */
  targetTable: string;
  /** Column names in the source table used for the relation. */
  fields?: string[];
  /** Column names in the target table referenced by this relation. */
  references?: string[];
  /** Disambiguation label for relations between tables with multiple FKs. */
  relationName?: string;
  /** File path where the relation is defined. */
  file: string;
}

/** Information about a defined enum. */
interface EnumInfo {
  /** Variable name of the enum (e.g., "roleEnum"). */
  varName: string;
  /** SQL name of the enum (e.g., "role_enum"). */
  sqlName: string;
}

/** Aggregated schema information. */
interface SchemaInfo {
  /** All schema file paths found in the schema directory. */
  schemaFiles: string[];
  /** Files exported from the root schema index.ts. */
  indexExports: string[];
  /** Map of directory path to files exported from that directory's index.ts. */
  indexExportsByDir: Map<string, string[]>;
  /** Map of table variable name to table information. */
  tables: Map<string, TableInfo>;
  /** Map of table name to its relation definitions. */
  relations: Map<string, RelationInfo[]>;
  /** Map of table name to its relations object name. */
  relationsNames: Map<string, string>;
  /** All enum types defined in the schema. */
  definedEnums: EnumInfo[];
  /** Names of all enum types exported from the schema (unused with barrel exports). */
  exportedEnums: string[];
}

// ============================================================================
// Constants
// ============================================================================

const SCHEMA_DIR = path.join(import.meta.dir, "../db/schema");
const IGNORED_FILES = ["index.ts", "helpers.ts"];

/** Join table naming patterns. */
const JOIN_TABLE_PATTERNS = [
  /^(\w+)To(\w+)$/, // studentsToCourses
  /^(\w+)_to_(\w+)$/, // students_to_courses (SQL name)
];

// ============================================================================
// Schema Loading
// ============================================================================

/**
 * Recursively get all .ts files in the schema directory.
 * @param dir - Directory to scan.
 * @returns Array of file paths.
 */
async function getSchemaFiles(dir: string = SCHEMA_DIR): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getSchemaFiles(fullPath)));
    } else if (entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Parse export statements from an index.ts file.
 * @param indexPath - Path to the index.ts file.
 * @returns Array of exported file/directory names.
 */
async function parseIndexExports(indexPath: string): Promise<string[]> {
  try {
    const content = await Bun.file(indexPath).text();
    const exports: string[] = [];

    // Match: export * from "./filename" or export * from "./dirname"
    // Process line by line to skip commented lines
    const regex = /export\s+\*\s+from\s+["']\.\/([^"']+)["']/;
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      // Skip commented lines
      if (trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;

      const match = trimmed.match(regex);
      if (match?.[1]) {
        exports.push(match[1].replace(/\.ts$/, ""));
      }
    }

    return exports;
  } catch {
    return [];
  }
}

/**
 * Parse all index.ts files and collect exports by directory.
 * @param schemaFiles - All schema files.
 * @returns Map of directory path to exported files.
 */
async function parseAllIndexExports(
  schemaFiles: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();

  // Get unique directories
  const dirs = new Set<string>();
  for (const file of schemaFiles) {
    dirs.add(path.dirname(file));
  }

  // Parse each directory's index.ts
  for (const dir of dirs) {
    const indexPath = path.join(dir, "index.ts");
    const exports = await parseIndexExports(indexPath);
    result.set(dir, exports);
  }

  return result;
}

/**
 * Find which file a table is defined in.
 * @param tableName - Name of the table variable.
 * @returns File path.
 */
async function findFileForTable(tableName: string): Promise<string> {
  const schemaFiles = await getSchemaFiles();

  for (const file of schemaFiles) {
    if (IGNORED_FILES.includes(path.basename(file))) continue;

    const content = await Bun.file(file).text();
    const pattern = new RegExp(
      `export\\s+const\\s+${tableName}\\s*=\\s*pgTable`,
    );
    if (pattern.test(content)) {
      return file;
    }
  }

  return "unknown";
}

/**
 * Extract JSDoc tags from a table's comment block.
 * @param file - File path.
 * @param tableName - Table variable name.
 * @returns Array of JSDoc tags.
 */
async function extractJsDocTags(
  file: string,
  tableName: string,
): Promise<string[]> {
  try {
    const content = await Bun.file(file).text();
    const pattern = new RegExp(
      `/\\*\\*([\\s\\S]*?)\\*/\\s*export\\s+const\\s+${tableName}\\s*=`,
      "m",
    );
    const match = content.match(pattern);
    if (!match || !match[1]) return [];

    const tags = match[1].match(/@[\w-]+/g) ?? [];
    return tags;
  } catch {
    return [];
  }
}

/**
 * Extract column information from Drizzle column metadata.
 * @param table - The Drizzle table.
 * @param columns - Drizzle columns object.
 * @returns Array of column info.
 */
function extractColumnInfo(
  table: AnyTable,
  columns: Record<string, PgColumn>,
): ColumnInfo[] {
  const result: ColumnInfo[] = [];
  const tableConfig = getTableConfig(table);

  // Build a map of column name -> FK reference info
  const fkMap = new Map<
    string,
    { table: string; column: string; columnSqlType: string; onDelete?: string }
  >();
  for (const fk of tableConfig.foreignKeys) {
    const ref = fk.reference();
    const sourceColumns = ref.columns;
    const foreignColumns = ref.foreignColumns;
    const foreignTableName = getTableName(ref.foreignTable as AnyTable);
    const onDelete = fk.onDelete;

    // Map each source column to its foreign reference
    for (let i = 0; i < sourceColumns.length; i++) {
      const sourceCol = sourceColumns[i];
      const foreignCol = foreignColumns[i];
      if (sourceCol && foreignCol) {
        fkMap.set(sourceCol.name, {
          table: findTableVariableName(foreignTableName),
          column: foreignCol.name,
          columnSqlType: foreignCol.getSQLType(),
          onDelete,
        });
      }
    }
  }

  for (const [name, column] of Object.entries(columns)) {
    const columnConfig = column as unknown as {
      primary?: boolean;
      enumValues?: string[];
    };

    result.push({
      name,
      sqlType: column.getSQLType(),
      isPrimaryKey: columnConfig.primary === true,
      isEnum: Array.isArray(columnConfig.enumValues),
      references: fkMap.get(name),
    });
  }

  return result;
}

/**
 * Find the variable name for a table given its SQL name.
 * @param sqlName - SQL table name.
 * @returns Variable name.
 */
function findTableVariableName(sqlName: string): string {
  for (const [key, value] of Object.entries(schema)) {
    if (isTable(value) && getTableName(value as AnyTable) === sqlName) {
      return key;
    }
  }
  return sqlName;
}

/**
 * Extract index information from a table.
 * @param table - Drizzle table.
 * @returns Array of index info.
 */
function extractIndexInfo(table: AnyTable): IndexInfo[] {
  const config = getTableConfig(table);
  return config.indexes.map((idx) => ({ name: idx.config.name ?? "unnamed" }));
}

/**
 * Extract check constraint information from a table.
 * @param table - Drizzle table.
 * @returns Array of check constraint info.
 */
function extractCheckConstraints(table: AnyTable): { name: string }[] {
  const config = getTableConfig(table);
  return config.checks.map((check) => ({ name: check.name ?? "unnamed" }));
}

/**
 * Check if a table uses the timestamps helper.
 * @param columns - Columns object.
 * @returns True if timestamps are present.
 */
function hasTimestamps(columns: Record<string, PgColumn>): boolean {
  return "createdAt" in columns && "updatedAt" in columns;
}

/**
 * Check if a value is a Drizzle relations object.
 * @param value - Value to check.
 * @returns True if it's a relations object.
 */
function isDrizzleRelations(value: unknown): value is DrizzleRelations {
  return (
    value !== null &&
    typeof value === "object" &&
    "table" in (value as object) &&
    "config" in (value as object) &&
    typeof (value as DrizzleRelations).config === "function"
  );
}

/**
 * Check if a value is a Drizzle enum.
 * @param value - Value to check.
 * @returns True if it's an enum.
 */
function isEnum(value: unknown): value is { enumName: string } {
  // Drizzle enums are functions with enumName and enumValues properties
  return (
    typeof value === "function" && "enumName" in value && "enumValues" in value
  );
}

/**
 * Extract relation information from Drizzle relations.
 * @param relationsObj - Relations object.
 * @param file - File where relations are defined.
 * @returns Array of relation info.
 */
function extractRelationInfo(
  relationsObj: DrizzleRelations,
  file: string,
): RelationInfo[] {
  const result: RelationInfo[] = [];

  try {
    const helpers = createTableRelationsHelpers(relationsObj.table);
    const config = relationsObj.config(helpers);

    for (const [name, rel] of Object.entries(config)) {
      const isOne = rel.constructor?.name === "One";
      const targetTableSqlName = getTableName(rel.referencedTable);

      result.push({
        name,
        type: isOne ? "one" : "many",
        targetTable: findTableVariableName(targetTableSqlName),
        fields: rel.config?.fields?.map((c) => c.name),
        references: rel.config?.references?.map((c) => c.name),
        relationName: rel.relationName,
        file,
      });
    }
  } catch {
    // Relations might not be extractable
  }

  return result;
}

/**
 * Load and parse the entire schema.
 * @returns Schema information.
 */
async function loadSchema(): Promise<SchemaInfo> {
  const schemaFiles = await getSchemaFiles();
  const indexExportsByDir = await parseAllIndexExports(schemaFiles);

  const schemaInfo: SchemaInfo = {
    schemaFiles,
    indexExports: indexExportsByDir.get(SCHEMA_DIR) ?? [],
    indexExportsByDir,
    tables: new Map(),
    relations: new Map(),
    relationsNames: new Map(),
    definedEnums: [],
    exportedEnums: [],
  };

  // Discover all exports from schema
  for (const [key, value] of Object.entries(schema)) {
    if (isTable(value)) {
      const tableName = key;
      const columns = getTableColumns(value);
      const sqlTableName = getTableName(value);
      const file = await findFileForTable(tableName);
      const jsDocTags = await extractJsDocTags(file, tableName);

      schemaInfo.tables.set(tableName, {
        file,
        sqlTableName,
        rawTable: value,
        columns: extractColumnInfo(value, columns),
        indexes: extractIndexInfo(value),
        checkConstraints: extractCheckConstraints(value),
        usesTimestamps: hasTimestamps(columns),
        exportedTypes: [], // Will be populated if needed
        jsDocTags,
        hasJsDocTag: (tag: string) => jsDocTags.includes(tag),
      });
    }

    if (isDrizzleRelations(value)) {
      const tableName = key.replace(/Relations$/, "");
      const file = await findFileForTable(tableName);
      schemaInfo.relations.set(tableName, extractRelationInfo(value, file));
      schemaInfo.relationsNames.set(tableName, key);
    }

    if (isEnum(value)) {
      schemaInfo.definedEnums.push({
        varName: key,
        sqlName: value.enumName,
      });
    }
  }

  return schemaInfo;
}

// ============================================================================
// Validators - High Priority
// ============================================================================

/**
 * Validate bidirectional relations.
 * Every many() should have a corresponding one(), and vice versa. When a
 * relationName is used for disambiguation, the inverse must declare the same
 * relationName. When multiple relations connect the same two tables, every
 * side must use a relationName so Drizzle can pair them unambiguously.
 * Handles self-referencing relations.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateBidirectionalRelations(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [tableName, relations] of schema.relations) {
    for (const rel of relations) {
      const isSelfReferencing = tableName === rel.targetTable;
      const targetRelations = schema.relations.get(rel.targetTable) ?? [];

      const candidates = targetRelations.filter((r) => {
        if (isSelfReferencing) {
          return r.targetTable === tableName && r.name !== rel.name;
        }
        return r.targetTable === tableName;
      });

      if (candidates.length === 0) {
        const signature =
          rel.type === "many"
            ? `many(${rel.targetTable})`
            : `one(${rel.targetTable}, ...)`;
        const inverseSignature =
          rel.type === "many"
            ? `one(${tableName}, ...)`
            : `relation back to ${tableName}`;
        errors.push({
          validator: "bidirectionalRelations",
          message: `${tableName} has ${signature}, but ${rel.targetTable}Relations has no ${inverseSignature}`,
          file: rel.file,
        });
        continue;
      }

      if (rel.relationName) {
        const matched = candidates.some(
          (r) => r.relationName === rel.relationName,
        );
        if (!matched) {
          errors.push({
            validator: "bidirectionalRelations",
            message: `${tableName}.${rel.name} uses relationName "${rel.relationName}", but ${rel.targetTable}Relations has no inverse with the same relationName`,
            file: rel.file,
          });
        }
        continue;
      }

      if (candidates.length > 1) {
        errors.push({
          validator: "bidirectionalRelations",
          message: `${tableName}.${rel.name} has no relationName, but ${rel.targetTable}Relations has multiple inverse candidates (${candidates.map((c) => c.name).join(", ")}). Add a matching relationName on both sides.`,
          file: rel.file,
        });
      }
    }
  }

  return errors;
}

/**
 * Check if a table name looks like a join table.
 * @param tableName - The table variable name.
 * @param sqlName - The SQL table name.
 * @returns True if the name matches join table patterns.
 */
function isLikelyJoinTableByName(tableName: string, sqlName: string): boolean {
  return JOIN_TABLE_PATTERNS.some(
    (pattern) => pattern.test(tableName) || pattern.test(sqlName),
  );
}

/**
 * Validate join table relations.
 * Join tables should have one() for each FK and referenced tables should have many().
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateJoinTableRelations(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [tableName, tableInfo] of schema.tables) {
    if (tableInfo.hasJsDocTag("@db-not-join-table")) continue;

    const fkColumns = tableInfo.columns.filter((c) => c.references);
    const nonFkColumns = tableInfo.columns.filter(
      (c) =>
        !c.references && !["id", "createdAt", "updatedAt"].includes(c.name),
    );

    const looksLikeJoinTable =
      fkColumns.length >= 2 && nonFkColumns.length <= 2;
    const hasJoinTableName = isLikelyJoinTableByName(
      tableName,
      tableInfo.sqlTableName,
    );

    const isJoinTable =
      (looksLikeJoinTable && hasJoinTableName) ||
      (fkColumns.length >= 2 && nonFkColumns.length === 0);

    if (!isJoinTable) continue;

    const tableRelations = schema.relations.get(tableName) ?? [];

    for (const fk of fkColumns) {
      if (!fk.references) continue;

      const hasOneRelation = tableRelations.some(
        (r) => r.type === "one" && r.targetTable === fk.references!.table,
      );

      if (!hasOneRelation) {
        errors.push({
          validator: "joinTableRelations",
          message: `Join table ${tableName} has FK to ${fk.references.table} but no one(${fk.references.table}, ...) relation`,
          file: tableInfo.file,
        });
      }

      const referencedTableRelations =
        schema.relations.get(fk.references.table) ?? [];
      const hasManyRelation = referencedTableRelations.some(
        (r) => r.type === "many" && r.targetTable === tableName,
      );

      if (!hasManyRelation) {
        errors.push({
          validator: "joinTableRelations",
          message: `${fk.references.table} should have many(${tableName}) for many-to-many relationship`,
          file: schema.tables.get(fk.references.table)?.file ?? "unknown",
        });
      }
    }
  }

  return errors;
}

/**
 * Validate that every FK column has a corresponding relation.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateForeignKeysHaveRelations(
  schema: SchemaInfo,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [tableName, tableInfo] of schema.tables) {
    const tableRelations = schema.relations.get(tableName) ?? [];

    for (const column of tableInfo.columns) {
      if (!column.references) continue;

      const hasRelation = tableRelations.some((r) =>
        r.fields?.includes(column.name),
      );

      if (!hasRelation) {
        errors.push({
          validator: "foreignKeysHaveRelations",
          message: `${tableName}.${column.name} references ${column.references.table}.${column.references.column} but has no corresponding relation`,
          file: tableInfo.file,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate that relation fields/references exist in their tables.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateRelationFieldsExist(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [tableName, relations] of schema.relations) {
    const tableInfo = schema.tables.get(tableName);

    for (const rel of relations) {
      if (rel.fields) {
        for (const field of rel.fields) {
          const columnExists = tableInfo?.columns.some((c) => c.name === field);
          if (!columnExists) {
            errors.push({
              validator: "relationFieldsExist",
              message: `Relation in ${tableName} references non-existent field: ${field}`,
              file: rel.file,
            });
          }
        }
      }

      if (rel.references) {
        const targetTable = schema.tables.get(rel.targetTable);
        for (const ref of rel.references) {
          const columnExists = targetTable?.columns.some((c) => c.name === ref);
          if (!columnExists) {
            errors.push({
              validator: "relationFieldsExist",
              message: `Relation in ${tableName} references non-existent column ${rel.targetTable}.${ref}`,
              file: rel.file,
            });
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Validate that FK column types match referenced column types.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateForeignKeyTypeMismatch(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [tableName, tableInfo] of schema.tables) {
    for (const column of tableInfo.columns) {
      if (!column.references) continue;

      // Compare the source column's SQL type with the referenced column's SQL type
      if (column.sqlType !== column.references.columnSqlType) {
        errors.push({
          validator: "foreignKeyTypeMismatch",
          message: `${tableName}.${column.name} (${column.sqlType}) references ${column.references.table}.${column.references.column} (${column.references.columnSqlType}) - type mismatch!`,
          file: tableInfo.file,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate that relation references match the actual FK constraint targets.
 * Catches cases where a relation's `references` points to a different column
 * than what the FK constraint actually references.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateRelationFkMismatch(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [tableName, relations] of schema.relations) {
    const tableInfo = schema.tables.get(tableName);
    if (!tableInfo) continue;

    for (const rel of relations) {
      // Only check one() relations that have fields and references defined
      if (rel.type !== "one" || !rel.fields || !rel.references) continue;

      // For each field in the relation, check if its FK matches the relation's reference
      for (let i = 0; i < rel.fields.length; i++) {
        const fieldName = rel.fields[i];
        const expectedRef = rel.references[i];
        if (!fieldName || !expectedRef) continue;

        // Find the column and its FK reference
        const column = tableInfo.columns.find((c) => c.name === fieldName);
        if (!column?.references) continue;

        // Check if the FK target matches the relation's reference
        if (column.references.column !== expectedRef) {
          errors.push({
            validator: "relationFkMismatch",
            message: `${tableName}.${fieldName}: relation references ${rel.targetTable}.${expectedRef}, but FK constraint references ${column.references.table}.${column.references.column}`,
            file: rel.file,
          });
        }

        // Also verify the FK points to the same table as the relation
        if (column.references.table !== rel.targetTable) {
          errors.push({
            validator: "relationFkMismatch",
            message: `${tableName}.${fieldName}: relation targets ${rel.targetTable}, but FK constraint targets ${column.references.table}`,
            file: rel.file,
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Validate that index names are unique across all tables.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateIndexNameUniqueness(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenIndexes = new Map<string, string>();

  for (const [tableName, tableInfo] of schema.tables) {
    for (const idx of tableInfo.indexes) {
      if (idx.name === "unnamed") continue;

      const existingTable = seenIndexes.get(idx.name);
      if (existingTable) {
        errors.push({
          validator: "indexNameUniqueness",
          message: `Duplicate index name "${idx.name}" in ${tableName} (already defined in ${existingTable})`,
          file: tableInfo.file,
        });
      } else {
        seenIndexes.set(idx.name, tableName);
      }
    }
  }

  return errors;
}

/**
 * Validate that check constraint names are unique across all tables.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateCheckConstraintNames(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenConstraints = new Map<string, string>();

  for (const [tableName, tableInfo] of schema.tables) {
    for (const constraint of tableInfo.checkConstraints) {
      if (constraint.name === "unnamed") continue;

      const existingTable = seenConstraints.get(constraint.name);
      if (existingTable) {
        errors.push({
          validator: "checkConstraintNames",
          message: `Duplicate check constraint name "${constraint.name}" in ${tableName} (already defined in ${existingTable})`,
          file: tableInfo.file,
        });
      } else {
        seenConstraints.set(constraint.name, tableName);
      }
    }
  }

  return errors;
}

// ============================================================================
// Validators - Medium Priority
// ============================================================================

/**
 * Validate that all schema files are exported from index.ts.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateAllFilesExported(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  const filesByDir = new Map<string, string[]>();
  for (const file of schema.schemaFiles) {
    const dir = path.dirname(file);
    const filename = path.basename(file).replace(/\.ts$/, "");
    if (!filesByDir.has(dir)) filesByDir.set(dir, []);
    filesByDir.get(dir)!.push(filename);
  }

  for (const [dir, files] of filesByDir) {
    const indexExports = schema.indexExportsByDir.get(dir) ?? [];

    for (const file of files) {
      if (IGNORED_FILES.includes(file + ".ts")) continue;

      if (!indexExports.includes(file)) {
        const relativePath = path.relative(SCHEMA_DIR, path.join(dir, file));
        errors.push({
          validator: "allFilesExported",
          message: `${relativePath}.ts is not exported from index.ts`,
          file: path.join(dir, "index.ts"),
        });
      }
    }
  }

  return errors;
}

/**
 * Validate that relation names don't collide with column names.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateRelationColumnNameCollisions(
  schema: SchemaInfo,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [tableName, tableInfo] of schema.tables) {
    const columnNames = new Set(tableInfo.columns.map((c) => c.name));
    const tableRelations = schema.relations.get(tableName) ?? [];

    for (const rel of tableRelations) {
      if (columnNames.has(rel.name)) {
        errors.push({
          validator: "relationColumnNameCollisions",
          message: `${tableName}: relation "${rel.name}" shadows column with same name. Rename the relation.`,
          file: tableInfo.file,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate that relation names don't collide with column names in the target table.
 * Prevents confusing situations where a relation name matches a column in the referenced table.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateRelationTargetColumnCollisions(
  schema: SchemaInfo,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [tableName, relations] of schema.relations) {
    const tableInfo = schema.tables.get(tableName);

    for (const rel of relations) {
      const targetTable = schema.tables.get(rel.targetTable);
      if (!targetTable) continue;

      const targetColumnNames = new Set(targetTable.columns.map((c) => c.name));

      if (targetColumnNames.has(rel.name)) {
        errors.push({
          validator: "relationTargetColumnCollisions",
          message: `${tableName}: relation "${rel.name}" matches column name in target table ${rel.targetTable}. Rename the relation to avoid confusion.`,
          file: tableInfo?.file ?? "unknown",
        });
      }
    }
  }

  return errors;
}

/**
 * Validate that every table has a primary key (column-level or composite).
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validatePrimaryKeys(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [tableName, tableInfo] of schema.tables) {
    const config = getTableConfig(tableInfo.rawTable);
    const hasCompositePk = config.primaryKeys.length > 0;
    const pkColumns = tableInfo.columns.filter((c) => c.isPrimaryKey);

    if (!hasCompositePk && pkColumns.length === 0) {
      errors.push({
        validator: "primaryKeys",
        message: `Table ${tableName} has no primary key defined`,
        file: tableInfo.file,
      });
    }

    if (hasCompositePk && pkColumns.length > 0) {
      errors.push({
        validator: "primaryKeys",
        message: `Table ${tableName} defines both composite and column-level PKs - use one or the other`,
        file: tableInfo.file,
      });
    }

    if (!hasCompositePk && pkColumns.length > 1) {
      errors.push({
        validator: "primaryKeys",
        message: `Table ${tableName} has multiple .primaryKey() columns. Use composite primaryKey() instead.`,
        file: tableInfo.file,
      });
    }
  }

  return errors;
}

/**
 * Validate enum exports.
 * @param _schema - The schema information (unused with barrel exports).
 * @returns Array of validation errors found.
 */
function validateEnumExports(_schema: SchemaInfo): ValidationError[] {
  // With barrel exports (export * from "./enums"), all enums are automatically exported
  // This validator is a no-op with the current setup
  return [];
}

/**
 * Validate that enum names follow the `<columnName>Enum` pattern.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateEnumNaming(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const enumInfo of schema.definedEnums) {
    // Must end with "Enum"
    if (!enumInfo.varName.endsWith("Enum")) {
      errors.push({
        validator: "enumNaming",
        message: `Enum "${enumInfo.varName}" should end with "Enum" suffix`,
        file: path.join(SCHEMA_DIR, "enums.ts"),
      });
    }
  }

  return errors;
}

/**
 * Find which columns an enum should be used in based on its name.
 * Pattern: `<columnName>Enum` -> matches any table with that column name.
 * @param enumVarName - Enum variable name.
 * @param schema - Schema information.
 * @returns Array of {tableName, columnName} pairs where enum should be used.
 */
function findEnumTargetColumns(
  enumVarName: string,
  schema: SchemaInfo,
): { tableName: string; columnName: string }[] {
  // Extract column name from enum name (e.g., "roleEnum" -> "role")
  const columnName = enumVarName.replace(/Enum$/, "");
  const matches: { tableName: string; columnName: string }[] = [];

  // Generate acceptable plural forms
  const pluralForms = [
    columnName + "s",
    columnName + "es",
    columnName.replace(/y$/, "ies"),
  ];

  for (const [tableName, tableInfo] of schema.tables) {
    for (const column of tableInfo.columns) {
      // Match column name exactly or any valid plural form
      if (column.name === columnName || pluralForms.includes(column.name)) {
        matches.push({ tableName, columnName: column.name });
      }
    }
  }

  return matches;
}

/**
 * Validate enum usage - ensures columns use their expected enum types.
 * Auto-detects which columns should use which enums based on naming conventions.
 * Also validates reverse direction: columns using enums must follow naming pattern.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateEnumUsage(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build a map of SQL enum name -> expected column name pattern
  const enumSqlToExpectedColumn = new Map<string, string>();
  for (const enumInfo of schema.definedEnums) {
    const expectedColumnName = enumInfo.varName.replace(/Enum$/, "");
    enumSqlToExpectedColumn.set(enumInfo.sqlName, expectedColumnName);
  }

  // Forward check: for each enum, find matching columns and verify they use it
  for (const enumInfo of schema.definedEnums) {
    const targetColumns = findEnumTargetColumns(enumInfo.varName, schema);

    for (const { tableName, columnName } of targetColumns) {
      const tableInfo = schema.tables.get(tableName);
      const column = tableInfo?.columns.find((c) => c.name === columnName);

      if (!column) continue;

      // Check if the column uses this enum (compare SQL names)
      const columnEnumSqlName = column.isEnum
        ? column.sqlType
        : column.sqlType.endsWith("[]")
          ? column.sqlType.slice(0, -2)
          : null;

      if (columnEnumSqlName !== enumInfo.sqlName) {
        errors.push({
          validator: "enumUsage",
          message: `${tableName}.${columnName} should use ${enumInfo.varName} but uses ${column.sqlType}`,
          file: tableInfo?.file ?? "unknown",
        });
      }
    }
  }

  // Reverse check: for each column using an enum, verify column name matches pattern
  for (const [tableName, tableInfo] of schema.tables) {
    for (const column of tableInfo.columns) {
      // Get the enum SQL name (handle both regular and array types)
      let enumSqlName: string | null = null;
      if (column.isEnum) {
        enumSqlName = column.sqlType;
      } else if (column.sqlType.endsWith("[]")) {
        // Check if it's an array of an enum type
        const baseType = column.sqlType.slice(0, -2);
        if (enumSqlToExpectedColumn.has(baseType)) {
          enumSqlName = baseType;
        }
      }

      if (!enumSqlName) continue;

      const expectedColumnName = enumSqlToExpectedColumn.get(enumSqlName);
      if (!expectedColumnName) continue;

      // Column name should match expectedColumnName or its plural form (for arrays)
      // Handle common English pluralization rules
      const pluralForms = [
        expectedColumnName + "s", // status -> statuss (not ideal but simple)
        expectedColumnName + "es", // box -> boxes
        expectedColumnName.replace(/y$/, "ies"), // category -> categories
      ];
      const columnNameMatches =
        column.name === expectedColumnName || pluralForms.includes(column.name);

      if (!columnNameMatches) {
        const pluralSuggestion = expectedColumnName.endsWith("y")
          ? expectedColumnName.replace(/y$/, "ies")
          : expectedColumnName + "s";
        errors.push({
          validator: "enumUsage",
          message: `${tableName}.${column.name} uses ${enumSqlName} but column should be named "${expectedColumnName}" (or "${pluralSuggestion}" for arrays)`,
          file: tableInfo.file,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate that all defined enums are used by at least one column.
 * Catches unused enums that should be removed or columns that should use them.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateAllEnumsUsed(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  // Collect all enum SQL names used by columns (including array types)
  const usedEnumSqlNames = new Set<string>();
  for (const [, tableInfo] of schema.tables) {
    for (const column of tableInfo.columns) {
      if (column.isEnum) {
        usedEnumSqlNames.add(column.sqlType);
      }
      // Also check for array enum types (e.g., "cnh_category_enum[]")
      if (column.sqlType.endsWith("[]")) {
        usedEnumSqlNames.add(column.sqlType.slice(0, -2));
      }
    }
  }

  // Check each defined enum is used
  for (const enumInfo of schema.definedEnums) {
    if (!usedEnumSqlNames.has(enumInfo.sqlName)) {
      errors.push({
        validator: "allEnumsUsed",
        message: `Enum "${enumInfo.varName}" (${enumInfo.sqlName}) is defined but not used by any column`,
        file: path.join(SCHEMA_DIR, "enums.ts"),
      });
    }
  }

  return errors;
}

// ============================================================================
// Validators - Low Priority
// ============================================================================

/**
 * Validate table variable naming conventions (camelCase, plural).
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateTableNaming(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [tableName, tableInfo] of schema.tables) {
    if (tableName.includes("_") || /^[A-Z]/.test(tableName)) {
      errors.push({
        validator: "tableNaming",
        message: `Table variable "${tableName}" should be camelCase`,
        file: tableInfo.file,
      });
    }

    if (!tableName.endsWith("s")) {
      errors.push({
        validator: "tableNaming",
        message: `Table variable "${tableName}" should be plural`,
        file: tableInfo.file,
      });
    }
  }

  return errors;
}

/**
 * Validate relations naming convention (<tableName>Relations).
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateRelationsNaming(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [tableName] of schema.tables) {
    const expectedRelationsName = `${tableName}Relations`;
    const actualRelationsName = schema.relationsNames.get(tableName);

    if (actualRelationsName && actualRelationsName !== expectedRelationsName) {
      errors.push({
        validator: "relationsNaming",
        message: `Relations for ${tableName} should be named "${expectedRelationsName}", found "${actualRelationsName}"`,
        file: schema.tables.get(tableName)?.file ?? "unknown",
      });
    }
  }

  return errors;
}

/**
 * Validate SQL table naming (snake_case).
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateSqlTableNaming(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [, tableInfo] of schema.tables) {
    const sqlName = tableInfo.sqlTableName;

    if (sqlName !== sqlName.toLowerCase()) {
      errors.push({
        validator: "sqlTableNaming",
        message: `SQL table name "${sqlName}" should be snake_case (lowercase)`,
        file: tableInfo.file,
      });
    }
  }

  return errors;
}

/**
 * Validate timestamps helper usage.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateTimestampsUsage(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [tableName, tableInfo] of schema.tables) {
    if (!tableInfo.usesTimestamps) {
      errors.push({
        validator: "timestampsUsage",
        message: `Table ${tableName} should use ...timestamps helper`,
        file: tableInfo.file,
      });
    }
  }

  return errors;
}

/**
 * Validate onDelete strategies for foreign keys.
 * @param schema - The schema information to validate.
 * @returns Array of validation errors found.
 */
function validateOnDeleteStrategies(schema: SchemaInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [tableName, tableInfo] of schema.tables) {
    for (const column of tableInfo.columns) {
      if (!column.references) continue;

      // Drizzle defaults to "no action" when onDelete is not specified.
      // We require explicit onDelete strategies to avoid accidental behavior.
      if (
        !column.references.onDelete ||
        column.references.onDelete === "no action"
      ) {
        errors.push({
          validator: "onDeleteStrategies",
          message: `${tableName}.${column.name} references ${column.references.table} but has no explicit onDelete strategy`,
          file: tableInfo.file,
        });
      }
    }
  }

  return errors;
}

// ============================================================================
// Error Reporting
// ============================================================================

/**
 * Report validation errors grouped by validator.
 * @param errors - Array of validation errors to report.
 */
function reportErrors(errors: ValidationError[]): void {
  const grouped = new Map<string, ValidationError[]>();

  for (const error of errors) {
    if (!grouped.has(error.validator)) {
      grouped.set(error.validator, []);
    }
    grouped.get(error.validator)!.push(error);
  }

  console.error("\nDatabase schema validation failed:\n");

  for (const [validator, validatorErrors] of grouped) {
    console.error(`[${validator}]`);
    for (const error of validatorErrors) {
      const relativePath = path.relative(process.cwd(), error.file);
      console.error(`  ✗ ${relativePath}: ${error.message}`);
    }
    console.error("");
  }

  console.error(`Found ${errors.length} error(s).`);
}

// ============================================================================
// Main Entry Point
// ============================================================================

/** Main entry point for the validation script. */
async function main(): Promise<void> {
  console.log("Validating database schema...\n");

  const schemaInfo = await loadSchema();
  const errors: ValidationError[] = [];

  // High priority - structural integrity
  errors.push(...validateBidirectionalRelations(schemaInfo));
  errors.push(...validateJoinTableRelations(schemaInfo));
  errors.push(...validateForeignKeysHaveRelations(schemaInfo));
  errors.push(...validateRelationFieldsExist(schemaInfo));
  errors.push(...validateForeignKeyTypeMismatch(schemaInfo));
  errors.push(...validateRelationFkMismatch(schemaInfo));
  errors.push(...validateIndexNameUniqueness(schemaInfo));
  errors.push(...validateCheckConstraintNames(schemaInfo));

  // Medium priority - naming & exports
  errors.push(...validateAllFilesExported(schemaInfo));
  errors.push(...validateRelationColumnNameCollisions(schemaInfo));
  errors.push(...validateRelationTargetColumnCollisions(schemaInfo));
  errors.push(...validatePrimaryKeys(schemaInfo));
  errors.push(...validateEnumExports(schemaInfo));
  errors.push(...validateEnumNaming(schemaInfo));
  errors.push(...validateEnumUsage(schemaInfo));
  errors.push(...validateAllEnumsUsed(schemaInfo));

  // Low priority - conventions
  errors.push(...validateTableNaming(schemaInfo));
  errors.push(...validateRelationsNaming(schemaInfo));
  errors.push(...validateSqlTableNaming(schemaInfo));
  errors.push(...validateTimestampsUsage(schemaInfo));
  errors.push(...validateOnDeleteStrategies(schemaInfo));

  if (errors.length > 0) {
    reportErrors(errors);
    process.exit(1);
  }

  console.log("✓ Schema validation passed");
}

main().catch((error) => {
  console.error("Validation script failed:", error);
  process.exit(1);
});
