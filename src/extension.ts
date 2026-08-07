import * as vscode from "vscode";
import { MezDefinitionProvider } from "./definitionProvider";
import { MezSymbolIndex } from "./symbolIndex";

let index: MezSymbolIndex | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  index = new MezSymbolIndex();
  await index.initialize();

  context.subscriptions.push(
    index,
    vscode.languages.registerDefinitionProvider(
      { language: "heliumrapid" },
      new MezDefinitionProvider(index)
    )
  );
}

export function deactivate(): void {
  index?.dispose();
  index = undefined;
}
