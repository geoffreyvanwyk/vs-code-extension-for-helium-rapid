import { maskNoise, offsetToPosition } from "./symbolExtractor";
import { TextRange, SymbolKind } from "./types";

export interface ReferenceQuery {
  name: string;
  kind: SymbolKind;
  containerName?: string;
}

/**
 * Find reference ranges for a symbol in one file's source text.
 * Comments and string literals are ignored (via maskNoise).
 */
export function findReferencesInText(text: string, query: ReferenceQuery): TextRange[] {
  const masked = maskNoise(text);
  const lineStarts = buildLineStarts(text);
  const ranges: TextRange[] = [];
  const escaped = escapeRegExp(query.name);

  let pattern: RegExp;
  switch (query.kind) {
    case "attribute":
      // `.shopCode` / `before.shopCode` — name after a member accessor
      pattern = new RegExp(`\\.\\s*(${escaped})\\b`, "g");
      break;
    case "enumMember":
      if (query.containerName) {
        pattern = new RegExp(
          `\\b${escapeRegExp(query.containerName)}\\s*\\.\\s*(${escaped})\\b`,
          "g"
        );
      } else {
        pattern = new RegExp(`\\b(${escaped})\\b`, "g");
      }
      break;
    case "validator":
      // bare name or @validatorName
      pattern = new RegExp(`(?:@)?\\b(${escaped})\\b`, "g");
      break;
    default:
      // object, enum, unit, function, variable — identifier occurrences
      pattern = new RegExp(`\\b(${escaped})\\b`, "g");
      break;
  }

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(masked)) !== null) {
    const nameGroup = match[1] ?? match[0];
    const nameStart = match.index + match[0].lastIndexOf(nameGroup);
    const nameEnd = nameStart + nameGroup.length;
    ranges.push({
      start: offsetToPosition(lineStarts, nameStart),
      end: offsetToPosition(lineStarts, nameEnd),
    });
  }

  return ranges;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
