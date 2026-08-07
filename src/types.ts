export type SymbolKind =
  | "unit"
  | "object"
  | "attribute"
  | "enum"
  | "enumMember"
  | "validator"
  | "function"
  | "variable";

export interface TextPosition {
  line: number;
  character: number;
}

export interface TextRange {
  start: TextPosition;
  end: TextPosition;
}

export interface ParameterInfo {
  name: string;
  typeName: string;
  isArray?: boolean;
}

/** Declaration extracted from a .mez file (URI filled in by the index). */
export interface MezSymbol {
  name: string;
  kind: SymbolKind;
  range: TextRange;
  /** Owning object/enum name for attributes and enum members. */
  containerName?: string;
  /** Declared type name for attributes and variables (without []). */
  typeName?: string;
  isArray?: boolean;
  /** Offset range where a variable binding is visible. */
  scopeStart?: number;
  scopeEnd?: number;
  /** Function return type (without []). */
  returnType?: string;
  returnIsArray?: boolean;
  /** Function parameters in declaration order. */
  parameters?: ParameterInfo[];
}

export interface IndexedSymbol extends MezSymbol {
  uri: string;
}

export const PRIMITIVES = new Set([
  "void",
  "int",
  "string",
  "decimal",
  "bigint",
  "bool",
  "date",
  "datetime",
  "uuid",
  "blob",
  "json",
  "jsonarray",
]);

export const PLATFORM_TYPES = new Set([
  "Mez",
  "String",
  "Strings",
  "Math",
  "sql",
  "MezBatch",
  "MezBatchItem",
]);
