import * as vscode from "vscode";
import { positionToOffset } from "./symbolExtractor";
import { MezSymbolIndex, toVscodeLocation } from "./symbolIndex";
import { IndexedSymbol, PLATFORM_TYPES, PRIMITIVES } from "./types";

const IDENT_CHAR = /[A-Za-z0-9_]/;

export class MezDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private readonly index: MezSymbolIndex) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Definition> {
    const lineText = document.lineAt(position.line).text;
    const token = identifierAt(lineText, position.character);
    if (!token) {
      return undefined;
    }

    const offset = positionToOffset(document.getText(), position.line, position.character);

    // Annotation: @requiredFieldValidator
    if (token.start > 0 && lineText[token.start - 1] === "@") {
      return locations(this.index.findByName(token.text, ["validator"]));
    }

    const before = lineText.slice(0, token.start);
    const after = lineText.slice(token.end);

    // Cursor on member/method after Type:
    const scopedLeft = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$/.exec(before);
    if (scopedLeft) {
      const typeName = scopedLeft[1];
      if (!PLATFORM_TYPES.has(typeName) && !PRIMITIVES.has(typeName)) {
        const unitHits = this.index.findByName(typeName, ["unit"]);
        if (unitHits.length > 0) {
          const unitUri = vscode.Uri.parse(unitHits[0].uri);
          const fn = this.index.findFunctionsInFile(unitUri, token.text);
          if (fn.length > 0) {
            return locations(fn);
          }
        }
        // Object:new / Object:equals — jump to the type
        return this.resolveTypeName(typeName);
      }
      return undefined;
    }

    // Cursor on Type in Type:foo
    if (/^\s*:\s*[A-Za-z_]/.test(after)) {
      return this.resolveTypeName(token.text);
    }

    // Member after '.' (supports chains: shop.owners.name)
    if (/\.\s*$/.test(before)) {
      const chain = memberChainBefore(before);
      if (chain.length > 0) {
        return this.resolveMemberChain(document, offset, chain, token.text);
      }
    }

    // Cursor on head of recv.prop / Enum.Member
    if (/^\s*\.\s*[A-Za-z_]/.test(after)) {
      const typeLocs = this.resolveTypeName(token.text);
      if (typeLocs) {
        return typeLocs;
      }
      const vars = this.findVariableBinding(document, offset, token.text);
      if (vars) {
        return locations([vars]);
      }
      return undefined;
    }

    return this.resolveBareName(document, offset, token.text);
  }

  private resolveBareName(
    document: vscode.TextDocument,
    offset: number,
    name: string
  ): vscode.Location[] | undefined {
    if (PRIMITIVES.has(name) || PLATFORM_TYPES.has(name)) {
      return undefined;
    }

    const types = this.index.findByName(name, ["object", "enum", "validator", "unit"]);
    if (types.length > 0) {
      return locations(types);
    }

    const localFns = this.index.findFunctionsInFile(document.uri, name);
    if (localFns.length > 0) {
      return locations(localFns);
    }

    const allFns = this.index.findByName(name, ["function"]);
    if (allFns.length > 0) {
      return locations(allFns);
    }

    const binding = this.findVariableBinding(document, offset, name);
    if (binding) {
      return locations([binding]);
    }

    return undefined;
  }

  private resolveTypeName(name: string): vscode.Location[] | undefined {
    if (PRIMITIVES.has(name) || PLATFORM_TYPES.has(name)) {
      return undefined;
    }
    const hits = this.index.findByName(name, ["object", "enum", "validator", "unit"]);
    return hits.length > 0 ? locations(hits) : undefined;
  }

  private resolveMemberChain(
    document: vscode.TextDocument,
    offset: number,
    chain: string[],
    member: string
  ): vscode.Location[] | undefined {
    const head = chain[0];

    // Enum.Member (single segment head)
    if (chain.length === 1 && /^[A-Z]/.test(head)) {
      const enumMembers = this.index.findEnumMember(head, member);
      if (enumMembers.length > 0) {
        return locations(enumMembers);
      }
    }

    let typeName = this.resolveReceiverType(document, offset, head);
    if (!typeName) {
      return undefined;
    }

    // Walk intermediate property segments to refine type
    for (let i = 1; i < chain.length; i++) {
      const attrType = this.index.getAttributeType(typeName, chain[i]);
      if (!attrType) {
        return undefined;
      }
      typeName = attrType.typeName;
    }

    const attrs = this.index.findAttribute(typeName, member);
    return attrs.length > 0 ? locations(attrs) : undefined;
  }

  private resolveReceiverType(
    document: vscode.TextDocument,
    offset: number,
    receiver: string
  ): string | undefined {
    if (receiver === "before" || receiver === "after") {
      return this.index.enclosingObjectAt(document.uri, offset);
    }

    if (/^[A-Z]/.test(receiver)) {
      const types = this.index.findByName(receiver, ["object", "enum"]);
      if (types.length > 0) {
        return receiver;
      }
    }

    const binding = this.findVariableBinding(document, offset, receiver);
    return binding?.typeName;
  }

  private findVariableBinding(
    document: vscode.TextDocument,
    offset: number,
    name: string
  ): IndexedSymbol | undefined {
    const vars = this.index.findVariablesInFile(document.uri).filter((v) => v.name === name);
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
}

function locations(symbols: IndexedSymbol[]): vscode.Location[] | undefined {
  if (symbols.length === 0) {
    return undefined;
  }
  return symbols.map(toVscodeLocation);
}

/** Identifiers in `a.b.c.` immediately before the current token. */
function memberChainBefore(before: string): string[] {
  const m = /(?:^|[^A-Za-z0-9_])((?:[A-Za-z_][A-Za-z0-9_]*)(?:\s*\.\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*\.\s*$/.exec(
    before
  );
  if (!m) {
    return [];
  }
  return m[1].split(/\s*\.\s*/).filter(Boolean);
}

function identifierAt(
  line: string,
  character: number
): { text: string; start: number; end: number } | undefined {
  if (character > line.length) {
    character = line.length;
  }
  let start = character;
  let end = character;

  if (start > 0 && !IDENT_CHAR.test(line[start] ?? "") && IDENT_CHAR.test(line[start - 1]!)) {
    start--;
    end = start + 1;
  }

  if (!IDENT_CHAR.test(line[start] ?? "") && start === end) {
    if (start > 0 && IDENT_CHAR.test(line[start - 1]!)) {
      start--;
      end = start + 1;
    } else {
      return undefined;
    }
  }

  while (start > 0 && IDENT_CHAR.test(line[start - 1]!)) {
    start--;
  }
  while (end < line.length && IDENT_CHAR.test(line[end]!)) {
    end++;
  }

  const text = line.slice(start, end);
  if (!text || !/^[A-Za-z_]/.test(text)) {
    return undefined;
  }
  return { text, start, end };
}
