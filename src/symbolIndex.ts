import * as vscode from "vscode";
import { extractSymbols, ExtractResult } from "./symbolExtractor";
import { IndexedSymbol, MezSymbol, SymbolKind } from "./types";

interface FileEntry {
  text: string;
  symbols: MezSymbol[];
  enclosingObjectAt: (offset: number) => string | undefined;
}

export class MezSymbolIndex implements vscode.Disposable {
  private readonly byUri = new Map<string, FileEntry>();
  private readonly watcher: vscode.FileSystemWatcher;
  private readonly disposables: vscode.Disposable[] = [];
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.watcher = vscode.workspace.createFileSystemWatcher("**/*.mez");
    this.disposables.push(
      this.watcher,
      this.watcher.onDidCreate((uri) => void this.indexUri(uri)),
      this.watcher.onDidChange((uri) => void this.indexUri(uri)),
      this.watcher.onDidDelete((uri) => this.removeFile(uri)),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.languageId === "heliumrapid" || e.document.uri.fsPath.endsWith(".mez")) {
          this.scheduleReindex(e.document);
        }
      })
    );
  }

  async initialize(): Promise<void> {
    const files = await vscode.workspace.findFiles("**/*.mez");
    await Promise.all(files.map((uri) => this.indexUri(uri)));
  }

  dispose(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.byUri.clear();
  }

  reindexDocument(document: vscode.TextDocument): void {
    this.setFile(document.uri, document.getText());
  }

  removeFile(uri: vscode.Uri): void {
    this.byUri.delete(uri.toString());
  }

  findByName(name: string, kinds?: SymbolKind[]): IndexedSymbol[] {
    const results: IndexedSymbol[] = [];
    for (const [uri, entry] of this.byUri) {
      for (const symbol of entry.symbols) {
        if (symbol.name !== name) {
          continue;
        }
        if (kinds && !kinds.includes(symbol.kind)) {
          continue;
        }
        results.push({ ...symbol, uri });
      }
    }
    return results;
  }

  findAttribute(objectName: string, attrName: string): IndexedSymbol[] {
    const results: IndexedSymbol[] = [];
    for (const [uri, entry] of this.byUri) {
      for (const symbol of entry.symbols) {
        if (
          symbol.kind === "attribute" &&
          symbol.containerName === objectName &&
          symbol.name === attrName
        ) {
          results.push({ ...symbol, uri });
        }
      }
    }
    return results;
  }

  findEnumMember(enumName: string, memberName: string): IndexedSymbol[] {
    const results: IndexedSymbol[] = [];
    for (const [uri, entry] of this.byUri) {
      for (const symbol of entry.symbols) {
        if (
          symbol.kind === "enumMember" &&
          symbol.containerName === enumName &&
          symbol.name === memberName
        ) {
          results.push({ ...symbol, uri });
        }
      }
    }
    return results;
  }

  findFunctionsInFile(uri: vscode.Uri, name: string): IndexedSymbol[] {
    const entry = this.byUri.get(uri.toString());
    if (!entry) {
      return [];
    }
    return entry.symbols
      .filter((s) => s.kind === "function" && s.name === name)
      .map((s) => ({ ...s, uri: uri.toString() }));
  }

  findVariablesInFile(uri: vscode.Uri): IndexedSymbol[] {
    const entry = this.byUri.get(uri.toString());
    if (!entry) {
      return [];
    }
    return entry.symbols
      .filter((s) => s.kind === "variable")
      .map((s) => ({ ...s, uri: uri.toString() }));
  }

  getAttributeType(objectName: string, attrName: string): { typeName: string; isArray?: boolean } | undefined {
    const attrs = this.findAttribute(objectName, attrName);
    if (attrs.length === 0 || !attrs[0].typeName) {
      return undefined;
    }
    return { typeName: attrs[0].typeName, isArray: attrs[0].isArray };
  }

  enclosingObjectAt(uri: vscode.Uri, offset: number): string | undefined {
    return this.byUri.get(uri.toString())?.enclosingObjectAt(offset);
  }

  getFileText(uri: vscode.Uri): string | undefined {
    return this.byUri.get(uri.toString())?.text;
  }

  /** All indexed `.mez` file texts as `[uriString, text]` pairs. */
  getAllFileTexts(): ReadonlyArray<readonly [string, string]> {
    const result: Array<readonly [string, string]> = [];
    for (const [uri, entry] of this.byUri) {
      result.push([uri, entry.text]);
    }
    return result;
  }

  private scheduleReindex(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      this.reindexDocument(document);
    }, 300);
    this.debounceTimers.set(key, timer);
  }

  private async indexUri(uri: vscode.Uri): Promise<void> {
    try {
      const open = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === uri.toString()
      );
      const text = open
        ? open.getText()
        : new TextDecoder("utf-8").decode(await vscode.workspace.fs.readFile(uri));
      this.setFile(uri, text);
    } catch {
      // File may have been deleted between events.
    }
  }

  private setFile(uri: vscode.Uri, text: string): void {
    const extracted: ExtractResult = extractSymbols(text);
    this.byUri.set(uri.toString(), {
      text,
      symbols: extracted.symbols,
      enclosingObjectAt: extracted.enclosingObjectAt,
    });
  }
}

export function toVscodeLocation(symbol: IndexedSymbol): vscode.Location {
  return new vscode.Location(
    vscode.Uri.parse(symbol.uri),
    new vscode.Range(
      new vscode.Position(symbol.range.start.line, symbol.range.start.character),
      new vscode.Position(symbol.range.end.line, symbol.range.end.character)
    )
  );
}
