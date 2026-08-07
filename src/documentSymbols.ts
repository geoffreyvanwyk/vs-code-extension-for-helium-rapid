import { MezSymbol, SymbolKind, TextRange } from "./types";

/** Framework-agnostic document symbol node for Outline / Go to Symbol in Editor. */
export interface OutlineSymbol {
  name: string;
  detail: string;
  kind: SymbolKind;
  range: TextRange;
  selectionRange: TextRange;
  children: OutlineSymbol[];
}

/**
 * Build a hierarchical outline of declarations in a document from extracted symbols.
 *
 * - Objects nest attributes
 * - Enums nest members
 * - Unit-level variables (file-wide scope) appear at the top level
 * - Function locals / parameters are omitted from the outline
 */
export function buildDocumentOutline(
  symbols: readonly MezSymbol[],
  fileLength: number
): OutlineSymbol[] {
  const objects = new Map<string, OutlineSymbol>();
  const enums = new Map<string, OutlineSymbol>();
  const topLevel: OutlineSymbol[] = [];

  const order: OutlineSymbol[] = [];

  for (const symbol of symbols) {
    if (symbol.kind === "attribute" || symbol.kind === "enumMember") {
      continue;
    }
    if (symbol.kind === "variable" && !isUnitLevelVariable(symbol, fileLength)) {
      continue;
    }

    const node = toOutline(symbol);
    order.push(node);

    if (symbol.kind === "object") {
      objects.set(symbol.name, node);
    } else if (symbol.kind === "enum") {
      enums.set(symbol.name, node);
    }
  }

  for (const symbol of symbols) {
    if (symbol.kind === "attribute" && symbol.containerName) {
      const parent = objects.get(symbol.containerName);
      if (parent) {
        parent.children.push(toOutline(symbol));
        continue;
      }
    }
    if (symbol.kind === "enumMember" && symbol.containerName) {
      const parent = enums.get(symbol.containerName);
      if (parent) {
        parent.children.push(toOutline(symbol));
      }
    }
  }

  order.sort(compareByPosition);
  for (const node of order) {
    node.children.sort(compareByPosition);
    topLevel.push(node);
  }

  return topLevel;
}

function compareByPosition(a: OutlineSymbol, b: OutlineSymbol): number {
  if (a.range.start.line !== b.range.start.line) {
    return a.range.start.line - b.range.start.line;
  }
  return a.range.start.character - b.range.start.character;
}

function isUnitLevelVariable(symbol: MezSymbol, fileLength: number): boolean {
  if (symbol.kind !== "variable") {
    return false;
  }
  const end = symbol.scopeEnd ?? fileLength;
  // Unit-level bindings are scoped to the end of the file by the extractor.
  return end >= fileLength;
}

function toOutline(symbol: MezSymbol): OutlineSymbol {
  const detail = detailFor(symbol);
  return {
    name: symbol.name,
    detail,
    kind: symbol.kind,
    range: symbol.range,
    selectionRange: symbol.range,
    children: [],
  };
}

function detailFor(symbol: MezSymbol): string {
  if (symbol.typeName) {
    return symbol.isArray ? `${symbol.typeName}[]` : symbol.typeName;
  }
  return "";
}
