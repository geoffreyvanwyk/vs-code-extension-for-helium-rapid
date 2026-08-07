import * as vscode from "vscode";
import { MezCompletionItemProvider } from "./completionProvider";
import { MezDefinitionProvider } from "./definitionProvider";
import { MezDocumentSymbolProvider } from "./documentSymbolProvider";
import { MezReferenceProvider } from "./referenceProvider";
import { MezRenameProvider } from "./renameProvider";
import { MezSymbolIndex } from "./symbolIndex";

let index: MezSymbolIndex | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  index = new MezSymbolIndex();
  await index.initialize();

  const selector = { language: "heliumrapid" };
  context.subscriptions.push(
    index,
    vscode.languages.registerDefinitionProvider(selector, new MezDefinitionProvider(index)),
    vscode.languages.registerReferenceProvider(selector, new MezReferenceProvider(index)),
    vscode.languages.registerDocumentSymbolProvider(
      selector,
      new MezDocumentSymbolProvider(index)
    ),
    vscode.languages.registerRenameProvider(selector, new MezRenameProvider(index)),
    vscode.languages.registerCompletionItemProvider(
      selector,
      new MezCompletionItemProvider(index),
      ".",
      ":",
      "@"
    )
  );
}

export function deactivate(): void {
  index?.dispose();
  index = undefined;
}
