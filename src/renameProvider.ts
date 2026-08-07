import * as vscode from "vscode";
import { collectReferenceLocations } from "./collectReferences";
import { identifierAt } from "./cursorUtils";
import { validateNewName } from "./renameValidation";
import { resolveSymbolAt } from "./resolveSymbol";
import { MezSymbolIndex } from "./symbolIndex";

export class MezRenameProvider implements vscode.RenameProvider {
  constructor(private readonly index: MezSymbolIndex) {}

  prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Range | { range: vscode.Range; placeholder: string }> {
    const resolved = resolveSymbolAt(this.index, document, position);
    if (!resolved) {
      throw new Error("You cannot rename this element.");
    }

    const lineText = document.lineAt(position.line).text;
    const token = identifierAt(lineText, position.character);
    if (!token || token.text !== resolved.name) {
      throw new Error(`Select '${resolved.name}' to rename this ${resolved.kind}.`);
    }

    const range = new vscode.Range(position.line, token.start, position.line, token.end);
    return { range, placeholder: resolved.name };
  }

  provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.WorkspaceEdit> {
    const resolved = resolveSymbolAt(this.index, document, position);
    if (!resolved) {
      throw new Error("You cannot rename this element.");
    }

    const validationError = validateNewName(newName, resolved.name);
    if (validationError) {
      throw new Error(validationError);
    }

    this.index.reindexDocument(document);

    const locations = collectReferenceLocations(this.index, resolved);
    if (locations.length === 0) {
      throw new Error("No rename locations found.");
    }

    const edit = new vscode.WorkspaceEdit();
    for (const location of locations) {
      edit.replace(location.uri, location.range, newName);
    }
    return edit;
  }
}
