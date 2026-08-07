import {
  MezSymbol,
  ParameterInfo,
  PRIMITIVES,
  TextPosition,
  TextRange,
} from "./types";

const TYPE_NAME =
  "(?:void|int|string|decimal|bigint|bool|date|datetime|uuid|blob|json|jsonarray|[A-Z][A-Za-z0-9_]*|__[a-z][a-z0-9_]*__)";

const ATTR_OR_VAR = new RegExp(
  `\\b(${TYPE_NAME})(\\[\\])?\\s+([a-z_][a-zA-Z0-9_]*)\\b`,
  "g"
);

const FUNCTION_DECL = new RegExp(
  `\\b(${TYPE_NAME})(\\[\\])?\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(`,
  "g"
);

const UNIT_DECL = /\bunit\s+([A-Z][A-Za-z0-9_]*)\s*;/g;
const OBJECT_DECL = /\b(?:persistent\s+)?object\s+([A-Z][A-Za-z0-9_]*)\s*\{/g;
const ENUM_DECL = /\benum\s+([A-Z][A-Za-z0-9_]*)\s*\{/g;
const VALIDATOR_DECL = /\bvalidator\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\{/g;
const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g;

export interface ExtractResult {
  symbols: MezSymbol[];
  /** Object name whose body contains the given offset, if any. */
  enclosingObjectAt(offset: number): string | undefined;
}

interface ObjectSpan {
  name: string;
  bodyStart: number;
  bodyEnd: number;
}

/**
 * Extract Helium Rapid declarations from source text.
 * Offsets are preserved by masking comments/strings with spaces.
 */
export function extractSymbols(text: string): ExtractResult {
  const masked = maskNoise(text);
  const lineStarts = buildLineStarts(text);
  const symbols: MezSymbol[] = [];
  const objectSpans: ObjectSpan[] = [];

  collectUnits(masked, lineStarts, symbols);
  collectObjects(masked, lineStarts, symbols, objectSpans);
  collectEnums(masked, lineStarts, symbols);
  collectValidators(masked, lineStarts, symbols);
  collectFunctionsAndVariables(masked, lineStarts, symbols, objectSpans);

  return {
    symbols,
    enclosingObjectAt(offset: number): string | undefined {
      for (const span of objectSpans) {
        if (offset >= span.bodyStart && offset <= span.bodyEnd) {
          return span.name;
        }
      }
      return undefined;
    },
  };
}

function collectUnits(
  masked: string,
  lineStarts: number[],
  symbols: MezSymbol[]
): void {
  UNIT_DECL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = UNIT_DECL.exec(masked)) !== null) {
    const name = match[1];
    const nameStart = match.index + match[0].indexOf(name);
    symbols.push({
      name,
      kind: "unit",
      range: rangeFromOffsets(lineStarts, nameStart, nameStart + name.length),
    });
  }
}

function collectObjects(
  masked: string,
  lineStarts: number[],
  symbols: MezSymbol[],
  objectSpans: ObjectSpan[]
): void {
  OBJECT_DECL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = OBJECT_DECL.exec(masked)) !== null) {
    const name = match[1];
    const nameStart = match.index + match[0].indexOf(name);
    const openBrace = match.index + match[0].length - 1;
    const closeBrace = findMatchingBrace(masked, openBrace);
    if (closeBrace < 0) {
      continue;
    }

    symbols.push({
      name,
      kind: "object",
      range: rangeFromOffsets(lineStarts, nameStart, nameStart + name.length),
    });

    const bodyStart = openBrace + 1;
    const bodyEnd = closeBrace;
    objectSpans.push({ name, bodyStart, bodyEnd });

    const body = masked.slice(bodyStart, bodyEnd);
    ATTR_OR_VAR.lastIndex = 0;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = ATTR_OR_VAR.exec(body)) !== null) {
      const absIndex = bodyStart + attrMatch.index;
      const afterName = absIndex + attrMatch[0].length;
      if (isFunctionCallSite(masked, afterName)) {
        continue;
      }
      // Skip keywords mistaken as types
      if (attrMatch[1] === "persistent" || attrMatch[1] === "object") {
        continue;
      }

      const typeName = stripArray(attrMatch[1]);
      const isArray = Boolean(attrMatch[2]) || attrMatch[1].endsWith("[]");
      const attrName = attrMatch[3];
      const attrNameStart = absIndex + attrMatch[0].lastIndexOf(attrName);

      symbols.push({
        name: attrName,
        kind: "attribute",
        containerName: name,
        typeName,
        isArray,
        range: rangeFromOffsets(
          lineStarts,
          attrNameStart,
          attrNameStart + attrName.length
        ),
      });
    }
  }
}

function collectEnums(
  masked: string,
  lineStarts: number[],
  symbols: MezSymbol[]
): void {
  ENUM_DECL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ENUM_DECL.exec(masked)) !== null) {
    const name = match[1];
    const nameStart = match.index + match[0].indexOf(name);
    const openBrace = match.index + match[0].length - 1;
    const closeBrace = findMatchingBrace(masked, openBrace);
    if (closeBrace < 0) {
      continue;
    }

    symbols.push({
      name,
      kind: "enum",
      range: rangeFromOffsets(lineStarts, nameStart, nameStart + name.length),
    });

    const body = masked.slice(openBrace + 1, closeBrace);
    IDENT.lastIndex = 0;
    let memberMatch: RegExpExecArray | null;
    while ((memberMatch = IDENT.exec(body)) !== null) {
      const member = memberMatch[0];
      const memberStart = openBrace + 1 + memberMatch.index;
      symbols.push({
        name: member,
        kind: "enumMember",
        containerName: name,
        range: rangeFromOffsets(
          lineStarts,
          memberStart,
          memberStart + member.length
        ),
      });
    }
  }
}

function collectValidators(
  masked: string,
  lineStarts: number[],
  symbols: MezSymbol[]
): void {
  VALIDATOR_DECL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = VALIDATOR_DECL.exec(masked)) !== null) {
    const name = match[1];
    const nameStart = match.index + match[0].indexOf(name);
    symbols.push({
      name,
      kind: "validator",
      range: rangeFromOffsets(lineStarts, nameStart, nameStart + name.length),
    });
  }
}

function collectFunctionsAndVariables(
  masked: string,
  lineStarts: number[],
  symbols: MezSymbol[],
  objectSpans: ObjectSpan[]
): void {
  const objectBodyRanges = objectSpans.map((s) => [s.bodyStart, s.bodyEnd] as const);
  const functionScopes: Array<{ start: number; end: number }> = [];

  FUNCTION_DECL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FUNCTION_DECL.exec(masked)) !== null) {
    const absIndex = match.index;

    // Skip if this looks like a call rather than a declaration: preceded by `.` or `:`
    if (isMemberOrScopedCall(masked, absIndex)) {
      continue;
    }

    const returnTypeRaw = match[1];
    const returnIsArray = Boolean(match[2]);
    const funcName = match[3];
    const nameStart = absIndex + match[0].lastIndexOf(funcName);
    const paramOpen = absIndex + match[0].length - 1;
    const paramClose = findMatchingParen(masked, paramOpen);
    if (paramClose < 0) {
      continue;
    }

    // Declaration must be followed by `{` (definition), not `;` or another token as call site.
    const afterParams = skipWs(masked, paramClose + 1);
    if (afterParams >= masked.length || masked[afterParams] !== "{") {
      continue;
    }

    const bodyOpen = afterParams;
    const bodyClose = findMatchingBrace(masked, bodyOpen);
    if (bodyClose < 0) {
      continue;
    }

    // Parameter bindings: visible in function body
    const params = masked.slice(paramOpen + 1, paramClose);
    const parameters = parseParameters(params);

    symbols.push({
      name: funcName,
      kind: "function",
      range: rangeFromOffsets(lineStarts, nameStart, nameStart + funcName.length),
      returnType: stripArray(returnTypeRaw),
      returnIsArray,
      parameters,
    });

    functionScopes.push({ start: paramOpen, end: bodyClose });

    collectTypedBindings(
      params,
      paramOpen + 1,
      lineStarts,
      symbols,
      bodyOpen + 1,
      bodyClose,
      /*allowPrimitives*/ true
    );

    // Locals inside function body
    const body = masked.slice(bodyOpen + 1, bodyClose);
    collectTypedBindings(
      body,
      bodyOpen + 1,
      lineStarts,
      symbols,
      bodyOpen + 1,
      bodyClose,
      /*allowPrimitives*/ true
    );
  }

  // Unit-level variable bindings (outside object bodies and function scopes)
  const skipRanges: Array<readonly [number, number]> = [
    ...objectBodyRanges,
    ...functionScopes.map((s) => [s.start, s.end] as const),
  ];

  ATTR_OR_VAR.lastIndex = 0;
  while ((match = ATTR_OR_VAR.exec(masked)) !== null) {
    const absIndex = match.index;
    if (isInsideRanges(absIndex, skipRanges)) {
      continue;
    }
    if (isFunctionCallSite(masked, absIndex + match[0].length)) {
      continue;
    }
    if (isMemberOrScopedCall(masked, absIndex)) {
      continue;
    }

    const typeRaw = match[1];
    if (PRIMITIVES.has(typeRaw) === false && !/^[A-Z_]/.test(typeRaw) && !typeRaw.startsWith("__")) {
      continue;
    }

    const typeName = stripArray(typeRaw);
    const isArray = Boolean(match[2]);
    const varName = match[3];
    const nameStart = absIndex + match[0].lastIndexOf(varName);

    // Avoid re-adding function names already captured
    const after = skipWs(masked, absIndex + match[0].length);
    if (after < masked.length && masked[after] === "(") {
      continue;
    }

    symbols.push({
      name: varName,
      kind: "variable",
      typeName,
      isArray,
      range: rangeFromOffsets(lineStarts, nameStart, nameStart + varName.length),
      scopeStart: nameStart,
      scopeEnd: masked.length,
    });
  }
}

/** Parse `Type name, Type[] other` parameter lists into structured info. */
export function parseParameters(paramsFragment: string): ParameterInfo[] {
  const parameters: ParameterInfo[] = [];
  ATTR_OR_VAR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_OR_VAR.exec(paramsFragment)) !== null) {
    if (isFunctionCallSite(paramsFragment, match.index + match[0].length)) {
      continue;
    }
    parameters.push({
      name: match[3],
      typeName: stripArray(match[1]),
      isArray: Boolean(match[2]),
    });
  }
  return parameters;
}

function collectTypedBindings(
  fragment: string,
  fragmentOffset: number,
  lineStarts: number[],
  symbols: MezSymbol[],
  scopeStart: number,
  scopeEnd: number,
  _allowPrimitives: boolean
): void {
  ATTR_OR_VAR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_OR_VAR.exec(fragment)) !== null) {
    const absIndex = fragmentOffset + match.index;
    if (isFunctionCallSite(fragment, match.index + match[0].length)) {
      continue;
    }

    const typeName = stripArray(match[1]);
    const isArray = Boolean(match[2]);
    const varName = match[3];
    const nameStart = absIndex + match[0].lastIndexOf(varName);

    symbols.push({
      name: varName,
      kind: "variable",
      typeName,
      isArray,
      range: rangeFromOffsets(lineStarts, nameStart, nameStart + varName.length),
      scopeStart,
      scopeEnd,
    });
  }
}

function isMemberOrScopedCall(masked: string, offset: number): boolean {
  let i = offset - 1;
  while (i >= 0 && /\s/.test(masked[i])) {
    i--;
  }
  if (i >= 0 && (masked[i] === "." || masked[i] === ":")) {
    return true;
  }
  return false;
}

function isFunctionCallSite(text: string, afterNameOffset: number): boolean {
  const i = skipWs(text, afterNameOffset);
  return i < text.length && text[i] === "(";
}

function isInsideRanges(
  offset: number,
  ranges: ReadonlyArray<readonly [number, number]>
): boolean {
  for (const [start, end] of ranges) {
    if (offset >= start && offset < end) {
      return true;
    }
  }
  return false;
}

function stripArray(typeName: string): string {
  return typeName.endsWith("[]") ? typeName.slice(0, -2) : typeName;
}

/** Replace comments and string literals with spaces (preserve offsets). */
export function maskNoise(text: string): string {
  const chars = text.split("");
  let i = 0;
  while (i < chars.length) {
    // line comment
    if (chars[i] === "/" && chars[i + 1] === "/") {
      while (i < chars.length && chars[i] !== "\n") {
        chars[i] = " ";
        i++;
      }
      continue;
    }
    // block comment
    if (chars[i] === "/" && chars[i + 1] === "*") {
      chars[i] = " ";
      chars[i + 1] = " ";
      i += 2;
      while (i < chars.length) {
        if (chars[i] === "*" && chars[i + 1] === "/") {
          chars[i] = " ";
          chars[i + 1] = " ";
          i += 2;
          break;
        }
        if (chars[i] !== "\n") {
          chars[i] = " ";
        }
        i++;
      }
      continue;
    }
    // multiline /% ... %/
    if (chars[i] === "/" && chars[i + 1] === "%") {
      chars[i] = " ";
      chars[i + 1] = " ";
      i += 2;
      while (i < chars.length) {
        if (chars[i] === "%" && chars[i + 1] === "/") {
          chars[i] = " ";
          chars[i + 1] = " ";
          i += 2;
          break;
        }
        if (chars[i] !== "\n") {
          chars[i] = " ";
        }
        i++;
      }
      continue;
    }
    // double-quoted string
    if (chars[i] === '"') {
      chars[i] = " ";
      i++;
      while (i < chars.length) {
        if (chars[i] === "\\") {
          chars[i] = " ";
          if (i + 1 < chars.length && chars[i + 1] !== "\n") {
            chars[i + 1] = " ";
          }
          i += 2;
          continue;
        }
        if (chars[i] === '"') {
          chars[i] = " ";
          i++;
          break;
        }
        if (chars[i] !== "\n") {
          chars[i] = " ";
        }
        i++;
      }
      continue;
    }
    i++;
  }
  return chars.join("");
}

export function findMatchingBrace(text: string, openIndex: number): number {
  return findMatching(text, openIndex, "{", "}");
}

export function findMatchingParen(text: string, openIndex: number): number {
  return findMatching(text, openIndex, "(", ")");
}

function findMatching(
  text: string,
  openIndex: number,
  open: string,
  close: string
): number {
  if (text[openIndex] !== open) {
    return -1;
  }
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function skipWs(text: string, offset: number): number {
  let i = offset;
  while (i < text.length && /\s/.test(text[i])) {
    i++;
  }
  return i;
}

function buildLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      starts.push(i + 1);
    }
  }
  return starts;
}

export function offsetToPosition(lineStarts: number[], offset: number): TextPosition {
  let line = 0;
  for (let i = 0; i < lineStarts.length; i++) {
    if (lineStarts[i] <= offset) {
      line = i;
    } else {
      break;
    }
  }
  return { line, character: offset - lineStarts[line] };
}

function rangeFromOffsets(
  lineStarts: number[],
  start: number,
  end: number
): TextRange {
  return {
    start: offsetToPosition(lineStarts, start),
    end: offsetToPosition(lineStarts, end),
  };
}

export function positionToOffset(
  text: string,
  line: number,
  character: number
): number {
  const lineStarts = buildLineStarts(text);
  if (line < 0 || line >= lineStarts.length) {
    return 0;
  }
  return lineStarts[line] + character;
}
