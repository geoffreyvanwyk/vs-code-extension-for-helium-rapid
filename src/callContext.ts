import { maskNoise } from "./symbolExtractor";

export interface CallContext {
  /** Function / method name being called. */
  functionName: string;
  /** Optional qualifier: `ShopMgmt` in `ShopMgmt:init(`, or receiver for `.method(`. */
  qualifier?: string;
  /** `scoped` for Type:name(, `method` for recv.name(, otherwise bare call. */
  callKind: "bare" | "scoped" | "method";
  /** Zero-based index of the argument containing the cursor. */
  activeParameter: number;
}

/**
 * Find the innermost function/method call that contains `offset`.
 */
export function findCallContext(text: string, offset: number): CallContext | undefined {
  const masked = maskNoise(text);
  if (offset < 0 || offset > masked.length) {
    return undefined;
  }

  let depth = 0;
  let activeParameter = 0;

  for (let i = offset - 1; i >= 0; i--) {
    const ch = masked[i];
    if (ch === ")") {
      depth++;
      continue;
    }
    if (ch === "(") {
      if (depth === 0) {
        const callee = readCalleeBefore(masked, i);
        if (!callee) {
          return undefined;
        }
        return {
          functionName: callee.functionName,
          qualifier: callee.qualifier,
          callKind: callee.callKind,
          activeParameter,
        };
      }
      depth--;
      continue;
    }
    if (ch === "," && depth === 0) {
      activeParameter++;
    }
  }

  return undefined;
}

function readCalleeBefore(
  masked: string,
  openParenIndex: number
): Omit<CallContext, "activeParameter"> | undefined {
  let i = openParenIndex - 1;
  while (i >= 0 && /\s/.test(masked[i]!)) {
    i--;
  }
  if (i < 0 || !/[A-Za-z0-9_]/.test(masked[i]!)) {
    return undefined;
  }

  let end = i + 1;
  while (i >= 0 && /[A-Za-z0-9_]/.test(masked[i]!)) {
    i--;
  }
  const functionName = masked.slice(i + 1, end);
  if (!functionName || !/^[A-Za-z_]/.test(functionName)) {
    return undefined;
  }

  while (i >= 0 && /\s/.test(masked[i]!)) {
    i--;
  }

  if (i >= 0 && masked[i] === ":") {
    i--;
    while (i >= 0 && /\s/.test(masked[i]!)) {
      i--;
    }
    const qualEnd = i + 1;
    while (i >= 0 && /[A-Za-z0-9_]/.test(masked[i]!)) {
      i--;
    }
    const qualifier = masked.slice(i + 1, qualEnd);
    if (qualifier && /^[A-Za-z_]/.test(qualifier)) {
      return { functionName, qualifier, callKind: "scoped" };
    }
  }

  if (i >= 0 && masked[i] === ".") {
    i--;
    while (i >= 0 && /\s/.test(masked[i]!)) {
      i--;
    }
    const qualEnd = i + 1;
    while (i >= 0 && /[A-Za-z0-9_]/.test(masked[i]!)) {
      i--;
    }
    const qualifier = masked.slice(i + 1, qualEnd);
    if (qualifier && /^[A-Za-z_]/.test(qualifier)) {
      return { functionName, qualifier, callKind: "method" };
    }
    return { functionName, callKind: "method" };
  }

  return { functionName, callKind: "bare" };
}
