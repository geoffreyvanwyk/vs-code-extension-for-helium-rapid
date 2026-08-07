import { IndexedSymbol, PLATFORM_TYPES, PRIMITIVES, SymbolKind } from "./types";

export type CompletionKind =
  | SymbolKind
  | "keyword"
  | "primitive"
  | "platform";

export interface CompletionProposal {
  label: string;
  kind: CompletionKind;
  detail?: string;
  insertText?: string;
}

export const KEYWORDS = [
  "if",
  "else",
  "for",
  "foreach",
  "throw",
  "try",
  "catch",
  "finally",
  "return",
  "object",
  "enum",
  "validator",
  "unit",
  "persistent",
  "via",
  "true",
  "false",
  "null",
  "before",
  "after",
  "beforeCreate",
  "afterCreate",
  "beforeUpdate",
  "afterUpdate",
  "beforeDelete",
  "afterDelete",
] as const;

export interface CompletionCatalog {
  types: IndexedSymbol[];
  validators: IndexedSymbol[];
  attributesOf(typeName: string): IndexedSymbol[];
  enumMembersOf(enumName: string): IndexedSymbol[];
  functionsInFile: IndexedSymbol[];
  variablesInScope: IndexedSymbol[];
  unitFunctions(unitName: string): IndexedSymbol[];
}

/**
 * Build completion proposals for the current editing context (pure / testable).
 */
export function buildCompletionProposals(
  mode: "general" | "member" | "scoped" | "annotation",
  options: {
    prefix: string;
    catalog: CompletionCatalog;
    /** For member mode: resolved type after `.` */
    memberType?: { typeName: string; isEnum: boolean };
    /** For scoped mode: name left of `:` */
    scopedName?: string;
  }
): CompletionProposal[] {
  const prefix = options.prefix.toLowerCase();
  const matches = (name: string): boolean =>
    !prefix || name.toLowerCase().startsWith(prefix);

  const proposals: CompletionProposal[] = [];
  const seen = new Set<string>();

  const add = (proposal: CompletionProposal): void => {
    if (!matches(proposal.label) || seen.has(proposal.label)) {
      return;
    }
    seen.add(proposal.label);
    proposals.push(proposal);
  };

  const fromSymbol = (symbol: IndexedSymbol, insertText?: string): void => {
    add({
      label: symbol.name,
      kind: symbol.kind,
      detail: detailFor(symbol),
      insertText,
    });
  };

  switch (mode) {
    case "member": {
      const memberType = options.memberType;
      if (!memberType) {
        break;
      }
      if (memberType.isEnum) {
        for (const member of options.catalog.enumMembersOf(memberType.typeName)) {
          fromSymbol(member);
        }
      } else {
        for (const attr of options.catalog.attributesOf(memberType.typeName)) {
          fromSymbol(attr);
        }
      }
      break;
    }
    case "scoped": {
      const scopedName = options.scopedName;
      if (!scopedName) {
        break;
      }
      for (const fn of options.catalog.unitFunctions(scopedName)) {
        fromSymbol(fn, `${fn.name}($0)`);
      }
      break;
    }
    case "annotation": {
      for (const validator of options.catalog.validators) {
        fromSymbol(validator);
      }
      break;
    }
    case "general":
    default: {
      for (const type of options.catalog.types) {
        fromSymbol(type);
      }
      for (const validator of options.catalog.validators) {
        fromSymbol(validator);
      }
      for (const fn of options.catalog.functionsInFile) {
        fromSymbol(fn, `${fn.name}($0)`);
      }
      for (const variable of options.catalog.variablesInScope) {
        fromSymbol(variable);
      }
      for (const primitive of PRIMITIVES) {
        add({ label: primitive, kind: "primitive", detail: "primitive" });
      }
      for (const platform of PLATFORM_TYPES) {
        add({ label: platform, kind: "platform", detail: "platform" });
      }
      for (const keyword of KEYWORDS) {
        add({ label: keyword, kind: "keyword" });
      }
      break;
    }
  }

  proposals.sort((a, b) => a.label.localeCompare(b.label));
  return proposals;
}

function detailFor(symbol: IndexedSymbol): string {
  const parts: string[] = [symbol.kind];
  if (symbol.containerName) {
    parts.push(`of ${symbol.containerName}`);
  }
  if (symbol.typeName) {
    parts.push(symbol.isArray ? `${symbol.typeName}[]` : symbol.typeName);
  }
  return parts.join(" · ");
}
