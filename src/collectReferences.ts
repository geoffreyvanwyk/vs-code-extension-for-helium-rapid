import * as vscode from "vscode";
import { findReferencesInText } from "./referenceFinder";
import { ResolvedSymbol } from "./resolveSymbol";
import { MezSymbolIndex, toVscodeLocation } from "./symbolIndex";
import { TextRange } from "./types";

/**
 * Collect all reference locations for a resolved symbol, including declarations.
 */
export function collectReferenceLocations(
  index: MezSymbolIndex,
  resolved: ResolvedSymbol
): vscode.Location[] {
  const locations: vscode.Location[] = [];
  const seen = new Set<string>();

  const addRange = (uri: vscode.Uri, range: TextRange): void => {
    const key = locationKey(uri.toString(), range);
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

  for (const decl of resolved.declarations) {
    const key = locationKey(decl.uri, decl.range);
    if (!seen.has(key)) {
      seen.add(key);
      locations.push(toVscodeLocation(decl));
    }
  }

  const files =
    resolved.kind === "variable" && resolved.fileUri
      ? ([[resolved.fileUri, index.getFileText(vscode.Uri.parse(resolved.fileUri))] as const])
      : index.getAllFileTexts();

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

  return locations;
}

function locationKey(uri: string, range: TextRange): string {
  return `${uri}:${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}`;
}
