import * as vscode from "vscode";
import {
  buildCompletionProposals,
  CompletionKind,
  CompletionProposal,
} from "./completionProposals";
import { memberChainBefore } from "./cursorUtils";
import { positionToOffset } from "./symbolExtractor";
import { resolveTypeOfChain } from "./resolveSymbol";
import { MezSymbolIndex } from "./symbolIndex";
import { IndexedSymbol } from "./types";

const IDENT_CHAR = /[A-Za-z0-9_]/;

export class MezCompletionItemProvider implements vscode.CompletionItemProvider {
  constructor(private readonly index: MezSymbolIndex) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    this.index.reindexDocument(document);

    const lineText = document.lineAt(position.line).text;
    const { prefix, start, end } = wordRangeAt(lineText, position.character);
    const beforeWord = lineText.slice(0, start);
    const offset = positionToOffset(document.getText(), position.line, position.character);
    const replaceRange = new vscode.Range(position.line, start, position.line, end);
    const catalog = this.buildCatalog(document, offset);

    // Annotation: @validator…
    const annotation = /@(\w*)$/.exec(lineText.slice(0, position.character));
    if (annotation) {
      const annPrefix = annotation[1];
      const annStart = position.character - annPrefix.length;
      const proposals = buildCompletionProposals("annotation", {
        prefix: annPrefix,
        catalog,
      });
      return proposals.map((p) =>
        toCompletionItem(p, new vscode.Range(position.line, annStart, position.line, end))
      );
    }

    // Member access: recv.  /  recv.pre
    if (/\.\s*$/.test(beforeWord)) {
      const chain = memberChainBefore(beforeWord);
      const memberType = resolveTypeOfChain(this.index, document, offset, chain);
      const proposals = buildCompletionProposals("member", {
        prefix,
        catalog,
        memberType,
      });
      return proposals.map((p) => toCompletionItem(p, replaceRange));
    }

    // Scoped call: Type:  /  Unit:pre
    const scoped = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$/.exec(beforeWord);
    if (scoped) {
      const proposals = buildCompletionProposals("scoped", {
        prefix,
        catalog,
        scopedName: scoped[1],
      });
      return proposals.map((p) => toCompletionItem(p, replaceRange));
    }

    const proposals = buildCompletionProposals("general", { prefix, catalog });
    return proposals.map((p) => toCompletionItem(p, replaceRange));
  }

  private buildCatalog(document: vscode.TextDocument, offset: number) {
    const index = this.index;
    const unitByName = new Map<string, string>();
    for (const unit of index.listByKinds(["unit"])) {
      unitByName.set(unit.name, unit.uri);
    }

    return {
      types: index.listByKinds(["object", "enum", "unit"]),
      validators: index.listByKinds(["validator"]),
      attributesOf: (typeName: string) => index.listAttributes(typeName),
      enumMembersOf: (enumName: string) => index.listEnumMembers(enumName),
      functionsInFile: index.listFunctionsInFile(document.uri),
      variablesInScope: index
        .findVariablesInFile(document.uri)
        .filter((v) => inScope(v, offset, document.getText())),
      unitFunctions: (unitName: string) => {
        const uri = unitByName.get(unitName);
        return uri ? index.listFunctionsInFile(vscode.Uri.parse(uri)) : [];
      },
    };
  }
}

function inScope(variable: IndexedSymbol, offset: number, text: string): boolean {
  const start = variable.scopeStart ?? 0;
  const end = variable.scopeEnd ?? Number.MAX_SAFE_INTEGER;
  if (offset < start || offset > end) {
    return false;
  }
  const declOffset = positionToOffset(
    text,
    variable.range.start.line,
    variable.range.start.character
  );
  return offset >= declOffset;
}

function wordRangeAt(
  line: string,
  character: number
): { prefix: string; start: number; end: number } {
  let start = character;
  while (start > 0 && IDENT_CHAR.test(line[start - 1]!)) {
    start--;
  }
  let end = character;
  while (end < line.length && IDENT_CHAR.test(line[end]!)) {
    end++;
  }
  return {
    prefix: line.slice(start, character),
    start,
    end,
  };
}

const KIND_MAP: Record<CompletionKind, vscode.CompletionItemKind> = {
  unit: vscode.CompletionItemKind.Module,
  object: vscode.CompletionItemKind.Class,
  attribute: vscode.CompletionItemKind.Property,
  enum: vscode.CompletionItemKind.Enum,
  enumMember: vscode.CompletionItemKind.EnumMember,
  validator: vscode.CompletionItemKind.Interface,
  function: vscode.CompletionItemKind.Function,
  variable: vscode.CompletionItemKind.Variable,
  keyword: vscode.CompletionItemKind.Keyword,
  primitive: vscode.CompletionItemKind.TypeParameter,
  platform: vscode.CompletionItemKind.Class,
};

function toCompletionItem(
  proposal: CompletionProposal,
  range: vscode.Range
): vscode.CompletionItem {
  const item = new vscode.CompletionItem(proposal.label, KIND_MAP[proposal.kind]);
  item.detail = proposal.detail;
  item.range = range;
  if (proposal.insertText) {
    item.insertText = new vscode.SnippetString(proposal.insertText);
  }
  return item;
}
