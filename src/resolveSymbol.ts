import * as vscode from "vscode";
import { identifierAt, memberChainBefore } from "./cursorUtils";
import { positionToOffset } from "./symbolExtractor";
import { MezSymbolIndex } from "./symbolIndex";
import { IndexedSymbol, PLATFORM_TYPES, PRIMITIVES, SymbolKind } from "./types";

/** Declaration(s) under the cursor, plus enough info to search for references. */
export interface ResolvedSymbol {
  name: string;
  kind: SymbolKind;
  containerName?: string;
  /** When set, reference search is limited to this file (variables). */
  fileUri?: string;
  declarations: IndexedSymbol[];
}

/**
 * Resolve the Helium symbol at a document position (shared by Definition / References).
 */
export function resolveSymbolAt(
  index: MezSymbolIndex,
  document: vscode.TextDocument,
  position: vscode.Position
): ResolvedSymbol | undefined {
  const lineText = document.lineAt(position.line).text;
  const token = identifierAt(lineText, position.character);
  if (!token) {
    return undefined;
  }

  const offset = positionToOffset(document.getText(), position.line, position.character);
  const before = lineText.slice(0, token.start);
  const after = lineText.slice(token.end);

  if (token.start > 0 && lineText[token.start - 1] === "@") {
    return fromDeclarations(index.findByName(token.text, ["validator"]));
  }

  const scopedLeft = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$/.exec(before);
  if (scopedLeft) {
    const typeName = scopedLeft[1];
    if (!PLATFORM_TYPES.has(typeName) && !PRIMITIVES.has(typeName)) {
      const unitHits = index.findByName(typeName, ["unit"]);
      if (unitHits.length > 0) {
        const unitUri = vscode.Uri.parse(unitHits[0].uri);
        const fn = index.findFunctionsInFile(unitUri, token.text);
        if (fn.length > 0) {
          return fromDeclarations(fn);
        }
      }
      return fromDeclarations(
        index.findByName(typeName, ["object", "enum", "validator", "unit"])
      );
    }
    return undefined;
  }

  if (/^\s*:\s*[A-Za-z_]/.test(after)) {
    return resolveTypeName(index, token.text);
  }

  if (/\.\s*$/.test(before)) {
    const chain = memberChainBefore(before);
    if (chain.length > 0) {
      return resolveMemberChain(index, document, offset, chain, token.text);
    }
  }

  if (/^\s*\.\s*[A-Za-z_]/.test(after)) {
    const typeHit = resolveTypeName(index, token.text);
    if (typeHit) {
      return typeHit;
    }
    const binding = findVariableBinding(index, document, offset, token.text);
    return binding
      ? {
          name: binding.name,
          kind: "variable",
          fileUri: binding.uri,
          declarations: [binding],
        }
      : undefined;
  }

  return resolveBareName(index, document, offset, token.text);
}

function resolveBareName(
  index: MezSymbolIndex,
  document: vscode.TextDocument,
  offset: number,
  name: string
): ResolvedSymbol | undefined {
  if (PRIMITIVES.has(name) || PLATFORM_TYPES.has(name)) {
    return undefined;
  }

  const types = index.findByName(name, ["object", "enum", "validator", "unit"]);
  if (types.length > 0) {
    return fromDeclarations(types);
  }

  // Attribute declaration inside an object body
  const enclosingObject = index.enclosingObjectAt(document.uri, offset);
  if (enclosingObject) {
    const attrs = index.findAttribute(enclosingObject, name);
    if (attrs.length > 0) {
      return {
        name,
        kind: "attribute",
        containerName: enclosingObject,
        declarations: attrs,
      };
    }
  }

  const localFns = index.findFunctionsInFile(document.uri, name);
  if (localFns.length > 0) {
    return fromDeclarations(localFns);
  }

  const allFns = index.findByName(name, ["function"]);
  if (allFns.length > 0) {
    return fromDeclarations(allFns);
  }

  // Enum member declaration (or unambiguous member name)
  const enumMembers = index.findByName(name, ["enumMember"]);
  if (enumMembers.length === 1) {
    return {
      name,
      kind: "enumMember",
      containerName: enumMembers[0].containerName,
      declarations: enumMembers,
    };
  }
  if (enumMembers.length > 1) {
    const inFile = enumMembers.filter((m) => m.uri === document.uri.toString());
    if (inFile.length === 1) {
      return {
        name,
        kind: "enumMember",
        containerName: inFile[0].containerName,
        declarations: inFile,
      };
    }
  }

  const binding = findVariableBinding(index, document, offset, name);
  return binding
    ? {
        name: binding.name,
        kind: "variable",
        fileUri: binding.uri,
        declarations: [binding],
      }
    : undefined;
}

function resolveTypeName(index: MezSymbolIndex, name: string): ResolvedSymbol | undefined {
  if (PRIMITIVES.has(name) || PLATFORM_TYPES.has(name)) {
    return undefined;
  }
  return fromDeclarations(index.findByName(name, ["object", "enum", "validator", "unit"]));
}

function resolveMemberChain(
  index: MezSymbolIndex,
  document: vscode.TextDocument,
  offset: number,
  chain: string[],
  member: string
): ResolvedSymbol | undefined {
  const head = chain[0];

  if (chain.length === 1 && /^[A-Z]/.test(head)) {
    const enumMembers = index.findEnumMember(head, member);
    if (enumMembers.length > 0) {
      return {
        name: member,
        kind: "enumMember",
        containerName: head,
        declarations: enumMembers,
      };
    }
  }

  let typeName = resolveReceiverType(index, document, offset, head);
  if (!typeName) {
    return undefined;
  }

  for (let i = 1; i < chain.length; i++) {
    const attrType = index.getAttributeType(typeName, chain[i]);
    if (!attrType) {
      return undefined;
    }
    typeName = attrType.typeName;
  }

  const attrs = index.findAttribute(typeName, member);
  if (attrs.length === 0) {
    return undefined;
  }
  return {
    name: member,
    kind: "attribute",
    containerName: typeName,
    declarations: attrs,
  };
}

function resolveReceiverType(
  index: MezSymbolIndex,
  document: vscode.TextDocument,
  offset: number,
  receiver: string
): string | undefined {
  if (receiver === "before" || receiver === "after") {
    return index.enclosingObjectAt(document.uri, offset);
  }

  if (/^[A-Z]/.test(receiver)) {
    const types = index.findByName(receiver, ["object", "enum"]);
    if (types.length > 0) {
      return receiver;
    }
  }

  return findVariableBinding(index, document, offset, receiver)?.typeName;
}

function findVariableBinding(
  index: MezSymbolIndex,
  document: vscode.TextDocument,
  offset: number,
  name: string
): IndexedSymbol | undefined {
  const vars = index.findVariablesInFile(document.uri).filter((v) => v.name === name);
  let best: IndexedSymbol | undefined;
  let bestSpan = Number.POSITIVE_INFINITY;
  const text = document.getText();

  for (const v of vars) {
    const start = v.scopeStart ?? 0;
    const end = v.scopeEnd ?? Number.MAX_SAFE_INTEGER;
    if (offset < start || offset > end) {
      continue;
    }
    const declOffset = positionToOffset(text, v.range.start.line, v.range.start.character);
    if (offset < declOffset) {
      continue;
    }
    const span = end - start;
    if (span < bestSpan) {
      best = v;
      bestSpan = span;
    }
  }

  return best;
}

function fromDeclarations(declarations: IndexedSymbol[]): ResolvedSymbol | undefined {
  if (declarations.length === 0) {
    return undefined;
  }
  const primary = declarations[0];
  return {
    name: primary.name,
    kind: primary.kind,
    containerName: primary.containerName,
    declarations,
  };
}
