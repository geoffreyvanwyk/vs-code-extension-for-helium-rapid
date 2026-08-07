import * as assert from "assert";
import { buildCompletionProposals, CompletionCatalog } from "./completionProposals";
import { IndexedSymbol } from "./types";

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`fail - ${name}`);
    throw err;
  }
}

function sym(
  partial: Partial<IndexedSymbol> & Pick<IndexedSymbol, "name" | "kind">
): IndexedSymbol {
  return {
    uri: "file:///x.mez",
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    ...partial,
  };
}

const catalog: CompletionCatalog = {
  types: [
    sym({ name: "Shop", kind: "object" }),
    sym({ name: "STATES", kind: "enum" }),
    sym({ name: "ShopMgmt", kind: "unit" }),
  ],
  validators: [sym({ name: "requiredFieldValidator", kind: "validator" })],
  attributesOf: (typeName) =>
    typeName === "Shop"
      ? [
          sym({ name: "shopCode", kind: "attribute", containerName: "Shop", typeName: "string" }),
          sym({ name: "name", kind: "attribute", containerName: "Shop", typeName: "string" }),
        ]
      : [],
  enumMembersOf: (enumName) =>
    enumName === "STATES"
      ? [
          sym({ name: "West_Coast", kind: "enumMember", containerName: "STATES" }),
          sym({ name: "Inland", kind: "enumMember", containerName: "STATES" }),
        ]
      : [],
  functionsInFile: [sym({ name: "init", kind: "function" })],
  variablesInScope: [sym({ name: "shop", kind: "variable", typeName: "Shop" })],
  unitFunctions: (unitName) =>
    unitName === "ShopMgmt" ? [sym({ name: "init", kind: "function" })] : [],
};

test("general completions include types, vars, keywords", () => {
  const items = buildCompletionProposals("general", { prefix: "sh", catalog });
  const labels = items.map((i) => i.label);
  assert.ok(labels.includes("Shop"));
  assert.ok(labels.includes("shop"));
  assert.ok(labels.includes("ShopMgmt"));
  assert.ok(!labels.includes("STATES"));
});

test("member completions list object attributes", () => {
  const items = buildCompletionProposals("member", {
    prefix: "sh",
    catalog,
    memberType: { typeName: "Shop", isEnum: false },
  });
  assert.deepStrictEqual(
    items.map((i) => i.label),
    ["shopCode"]
  );
});

test("member completions list enum members", () => {
  const items = buildCompletionProposals("member", {
    prefix: "",
    catalog,
    memberType: { typeName: "STATES", isEnum: true },
  });
  assert.deepStrictEqual(
    items.map((i) => i.label).sort(),
    ["Inland", "West_Coast"]
  );
});

test("scoped completions list unit functions", () => {
  const items = buildCompletionProposals("scoped", {
    prefix: "",
    catalog,
    scopedName: "ShopMgmt",
  });
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].label, "init");
  assert.ok(items[0].insertText?.includes("("));
});

test("annotation completions list validators", () => {
  const items = buildCompletionProposals("annotation", {
    prefix: "req",
    catalog,
  });
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].label, "requiredFieldValidator");
});

console.log("\nAll completion proposal tests passed.");
