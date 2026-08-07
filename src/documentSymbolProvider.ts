import * as vscode from "vscode";
import { buildDocumentOutline, OutlineSymbol } from "./documentSymbols";
import { MezSymbolIndex } from "./symbolIndex";
import { SymbolKind } from "./types";

const KIND_MAP: Record<SymbolKind, vscode.SymbolKind> = {
  unit: vscode.SymbolKind.Namespace,
  object: vscode.SymbolKind.Class,
  attribute: vscode.SymbolKind.Property,
  enum: vscode.SymbolKind.Enum,
  enumMember: vscode.SymbolKind.EnumMember,
  validator: vscode.SymbolKind.Interface,
  function: vscode.SymbolKind.Function,
  variable: vscode.SymbolKind.Variable,
};

export class MezDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  constructor(private readonly index: MezSymbolIndex) {}

  provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    // Prefer live document text so Outline stays in sync while typing.
    this.index.reindexDocument(document);

    const symbols = this.index.getSymbolsForDocument(document.uri);
    const outline = buildDocumentOutline(symbols, document.getText().length);
    return outline.map(toVscodeDocumentSymbol);
  }
}

function toVscodeDocumentSymbol(node: OutlineSymbol): vscode.DocumentSymbol {
  const range = toRange(node.range);
  const selectionRange = toRange(node.selectionRange);
  const symbol = new vscode.DocumentSymbol(
    node.name,
    node.detail,
    KIND_MAP[node.kind],
    range,
    selectionRange
  );
  symbol.children = node.children.map(toVscodeDocumentSymbol);
  return symbol;
}

function toRange(range: OutlineSymbol["range"]): vscode.Range {
  return new vscode.Range(
    new vscode.Position(range.start.line, range.start.character),
    new vscode.Position(range.end.line, range.end.character)
  );
}
