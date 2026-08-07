import * as vscode from "vscode";
import { resolveSymbolAt } from "./resolveSymbol";
import { MezSymbolIndex, toVscodeLocation } from "./symbolIndex";

export class MezDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private readonly index: MezSymbolIndex) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Definition> {
    const resolved = resolveSymbolAt(this.index, document, position);
    if (!resolved || resolved.declarations.length === 0) {
      return undefined;
    }
    return resolved.declarations.map(toVscodeLocation);
  }
}
