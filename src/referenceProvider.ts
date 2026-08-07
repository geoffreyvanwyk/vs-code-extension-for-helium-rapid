import * as vscode from "vscode";
import { collectReferenceLocations } from "./collectReferences";
import { resolveSymbolAt } from "./resolveSymbol";
import { MezSymbolIndex } from "./symbolIndex";

export class MezReferenceProvider implements vscode.ReferenceProvider {
  constructor(private readonly index: MezSymbolIndex) {}

  provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.ReferenceContext,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Location[]> {
    const resolved = resolveSymbolAt(this.index, document, position);
    if (!resolved) {
      return undefined;
    }

    const locations = collectReferenceLocations(this.index, resolved);
    return locations.length > 0 ? locations : undefined;
  }
}
