import * as vscode from "vscode";
import { findCallContext } from "./callContext";
import { positionToOffset } from "./symbolExtractor";
import { buildSignatureHelp, pickFunctionForCall } from "./signatureHelp";
import { MezSymbolIndex } from "./symbolIndex";

export class MezSignatureHelpProvider implements vscode.SignatureHelpProvider {
  constructor(private readonly index: MezSymbolIndex) {}

  provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.SignatureHelpContext
  ): vscode.ProviderResult<vscode.SignatureHelp> {
    this.index.reindexDocument(document);

    const text = document.getText();
    const offset = positionToOffset(text, position.line, position.character);
    const call = findCallContext(text, offset);
    if (!call) {
      return undefined;
    }

    const preferredUris: string[] = [document.uri.toString()];
    if (call.callKind === "scoped" && call.qualifier) {
      const units = this.index.findByName(call.qualifier, ["unit"]);
      for (const unit of units) {
        preferredUris.push(unit.uri);
      }
    }

    const candidates = this.index.findByName(call.functionName, ["function"]);
    const fn = pickFunctionForCall(call, candidates, preferredUris);
    if (!fn) {
      return undefined;
    }

    const model = buildSignatureHelp(fn, call);
    if (!model) {
      return undefined;
    }

    const signature = new vscode.SignatureInformation(model.label);
    signature.parameters = model.parameters.map(
      (p) => new vscode.ParameterInformation(p.label, p.documentation)
    );

    const help = new vscode.SignatureHelp();
    help.signatures = [signature];
    help.activeSignature = 0;
    help.activeParameter = model.activeParameter;
    return help;
  }
}
