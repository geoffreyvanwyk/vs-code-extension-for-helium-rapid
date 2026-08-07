import { PRIMITIVES } from "./types";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const RESERVED = new Set([
  ...PRIMITIVES,
  "if",
  "else",
  "for",
  "foreach",
  "throw",
  "try",
  "catch",
  "finally",
  "return",
  "object",
  "enum",
  "validator",
  "unit",
  "persistent",
  "via",
  "true",
  "false",
  "null",
  "before",
  "after",
  "beforeCreate",
  "afterCreate",
  "beforeUpdate",
  "afterUpdate",
  "beforeDelete",
  "afterDelete",
]);

export function validateNewName(newName: string, currentName: string): string | undefined {
  if (!newName || newName === currentName) {
    return newName === currentName ? "New name must differ from the current name." : "Invalid name.";
  }
  if (!IDENTIFIER.test(newName)) {
    return "Name must be a Helium identifier (letters, digits, underscore; cannot start with a digit).";
  }
  if (RESERVED.has(newName)) {
    return `'${newName}' is a reserved word.`;
  }
  return undefined;
}
