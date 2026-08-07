import * as assert from "assert";
import { findCallContext } from "./callContext";
import { extractSymbols } from "./symbolExtractor";
import { buildSignatureHelp, pickFunctionForCall } from "./signatureHelp";
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

test("finds bare call and active parameter", () => {
  const text = "saveShop(a, b, c)";
  const atB = text.indexOf("b") + 1;
  const ctx = findCallContext(text, atB);
  assert.ok(ctx);
  assert.strictEqual(ctx!.functionName, "saveShop");
  assert.strictEqual(ctx!.callKind, "bare");
  assert.strictEqual(ctx!.activeParameter, 1);
});

test("finds scoped call", () => {
  const text = "ShopMgmt:init(";
  const ctx = findCallContext(text, text.length);
  assert.ok(ctx);
  assert.strictEqual(ctx!.functionName, "init");
  assert.strictEqual(ctx!.qualifier, "ShopMgmt");
  assert.strictEqual(ctx!.callKind, "scoped");
  assert.strictEqual(ctx!.activeParameter, 0);
});

test("ignores calls inside strings", () => {
  const text = 'string x = "init(a, b"; foo(';
  const ctx = findCallContext(text, text.length);
  assert.ok(ctx);
  assert.strictEqual(ctx!.functionName, "foo");
});

test("extracts function parameters and return type", () => {
  const src = `
string addOwner(ShopOwner ownerToAdd, bool notify) {
	return null;
}
`;
  const { symbols } = extractSymbols(src);
  const fn = symbols.find((s) => s.kind === "function" && s.name === "addOwner");
  assert.ok(fn);
  assert.strictEqual(fn!.returnType, "string");
  assert.deepStrictEqual(
    fn!.parameters?.map((p) => `${p.typeName} ${p.name}`),
    ["ShopOwner ownerToAdd", "bool notify"]
  );
});

test("buildSignatureHelp formats label and clamps active param", () => {
  const fn: IndexedSymbol = {
    name: "addOwner",
    kind: "function",
    uri: "file:///x.mez",
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    returnType: "string",
    parameters: [
      { name: "ownerToAdd", typeName: "ShopOwner" },
      { name: "notify", typeName: "bool" },
    ],
  };
  const help = buildSignatureHelp(fn, {
    functionName: "addOwner",
    callKind: "bare",
    activeParameter: 5,
  });
  assert.ok(help);
  assert.strictEqual(help!.label, "string addOwner(ShopOwner ownerToAdd, bool notify)");
  assert.strictEqual(help!.activeParameter, 1);
  assert.strictEqual(help!.parameters.length, 2);
});

test("pickFunctionForCall prefers preferred URI", () => {
  const a: IndexedSymbol = {
    name: "init",
    kind: "function",
    uri: "file:///a.mez",
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
  };
  const b: IndexedSymbol = {
    name: "init",
    kind: "function",
    uri: "file:///b.mez",
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
  };
  const picked = pickFunctionForCall(
    { functionName: "init", callKind: "bare", activeParameter: 0 },
    [a, b],
    ["file:///b.mez"]
  );
  assert.strictEqual(picked?.uri, "file:///b.mez");
});

console.log("\nAll signature help tests passed.");
