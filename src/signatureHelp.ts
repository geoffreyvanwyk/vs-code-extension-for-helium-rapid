import { CallContext } from "./callContext";
import { IndexedSymbol, ParameterInfo } from "./types";

export interface SignatureHelpModel {
  label: string;
  parameters: Array<{ label: string; documentation?: string }>;
  activeParameter: number;
  documentation?: string;
}

/**
 * Build signature-help UI model for a resolved function symbol and call context.
 */
export function buildSignatureHelp(
  fn: IndexedSymbol,
  call: CallContext
): SignatureHelpModel | undefined {
  if (fn.kind !== "function") {
    return undefined;
  }

  const parameters = fn.parameters ?? [];
  const returnType = formatType(fn.returnType ?? "void", fn.returnIsArray);
  const paramLabels = parameters.map(formatParameter);
  const label = `${returnType} ${fn.name}(${paramLabels.join(", ")})`;

  const activeParameter =
    parameters.length === 0 ? 0 : Math.min(call.activeParameter, parameters.length - 1);

  return {
    label,
    parameters: paramLabels.map((labelText, index) => ({
      label: labelText,
      documentation: parameters[index]
        ? `${formatType(parameters[index].typeName, parameters[index].isArray)} parameter`
        : undefined,
    })),
    activeParameter,
  };
}

/**
 * Choose the best function declaration for a call from candidate symbols.
 * `preferredUris` are tried first (e.g. current file, then unit file).
 */
export function pickFunctionForCall(
  call: CallContext,
  candidates: IndexedSymbol[],
  preferredUris: string[] = []
): IndexedSymbol | undefined {
  const named = candidates.filter(
    (s) => s.kind === "function" && s.name === call.functionName
  );
  if (named.length === 0) {
    return undefined;
  }

  for (const uri of preferredUris) {
    const match = named.find((s) => s.uri === uri);
    if (match) {
      return match;
    }
  }

  return named[0];
}

export function formatParameter(param: ParameterInfo): string {
  return `${formatType(param.typeName, param.isArray)} ${param.name}`;
}

export function formatType(typeName: string, isArray?: boolean): string {
  return isArray ? `${typeName}[]` : typeName;
}
