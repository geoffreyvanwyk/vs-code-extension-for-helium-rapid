import * as vscode from "vscode";
import { findReferencesInText } from "./referenceFinder";
import { resolveSymbolAt } from "./resolveSymbol";
import { MezSymbolIndex, toVscodeLocation } from "./symbolIndex";
import { TextRange } from "./types";

export class MezReferenceProvider implements vscode.ReferenceProvider {
  constructor(private readonly index: MezSymbolIndex) {}

  provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Location[]> {
    const resolved = resolveSymbolAt(this.index, document, position);
    if (!resolved) {
      return undefined;
    }

    const locations: vscode.Location[] = [];
    const seen = new Set<string>();

    const addRange = (uri: vscode.Uri, range: TextRange): void => {
      const key = `${uri.toString()}:${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      locations.push(
        new vscode.Location(
          uri,
          new vscode.Range(
            new vscode.Position(range.start.line, range.start.character),
            new vscode.Position(range.end.line, range.end.character)
          )
        )
      );
    };

    if (context.includeDeclaration) {
      for (const decl of resolved.declarations) {
        locations.push(toVscodeLocation(decl));
        const key = `${decl.uri}:${decl.range.start.line}:${decl.range.start.character}:${decl.range.end.line}:${decl.range.end.character}`;
        seen.add(key);
      }
    }

    const files =
      resolved.kind === "variable" && resolved.fileUri
        ? [[resolved.fileUri, this.index.getFileText(vscode.Uri.parse(resolved.fileUri)) ] as const]
        : this.index.getAllFileTexts();

    for (const [uriString, text] of files) {
      if (!text) {
        continue;
      }
      const uri = vscode.Uri.parse(uriString);
      const ranges = findReferencesInText(text, {
        name: resolved.name,
        kind: resolved.kind,
        containerName: resolved.containerName,
      });
      for (const range of ranges) {
        addRange(uri, range);
      }
    }

    return locations.length > 0 ? locations : undefined;
  }
}
