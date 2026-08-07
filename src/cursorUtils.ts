const IDENT_CHAR = /[A-Za-z0-9_]/;

export interface IdentifierToken {
  text: string;
  start: number;
  end: number;
}

export function identifierAt(
  line: string,
  character: number
): IdentifierToken | undefined {
  if (character > line.length) {
    character = line.length;
  }
  let start = character;
  let end = character;

  if (start > 0 && !IDENT_CHAR.test(line[start] ?? "") && IDENT_CHAR.test(line[start - 1]!)) {
    start--;
    end = start + 1;
  }

  if (!IDENT_CHAR.test(line[start] ?? "") && start === end) {
    if (start > 0 && IDENT_CHAR.test(line[start - 1]!)) {
      start--;
      end = start + 1;
    } else {
      return undefined;
    }
  }

  while (start > 0 && IDENT_CHAR.test(line[start - 1]!)) {
    start--;
  }
  while (end < line.length && IDENT_CHAR.test(line[end]!)) {
    end++;
  }

  const text = line.slice(start, end);
  if (!text || !/^[A-Za-z_]/.test(text)) {
    return undefined;
  }
  return { text, start, end };
}

/** Identifiers in `a.b.c.` immediately before the current token. */
export function memberChainBefore(before: string): string[] {
  const m = /(?:^|[^A-Za-z0-9_])((?:[A-Za-z_][A-Za-z0-9_]*)(?:\s*\.\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*\.\s*$/.exec(
    before
  );
  if (!m) {
    return [];
  }
  return m[1].split(/\s*\.\s*/).filter(Boolean);
}
