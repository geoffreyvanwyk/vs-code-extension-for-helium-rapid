import * as assert from "assert";
import { findReferencesInText } from "./referenceFinder";

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`fail - ${name}`);
    throw err;
  }
}

test("finds type name references across usages", () => {
  const text = `
persistent object Shop {
	string name;
}
unit ShopMgmt;
Shop shop;
shop = Shop:new();
`;
  const refs = findReferencesInText(text, { name: "Shop", kind: "object" });
  assert.ok(refs.length >= 3, `expected >= 3, got ${refs.length}`);
});

test("finds attribute member accesses", () => {
  const text = `
void init() {
	shop.shopCode = "x";
	before.shopCode = shop.shopCode;
}
`;
  const refs = findReferencesInText(text, {
    name: "shopCode",
    kind: "attribute",
    containerName: "Shop",
  });
  assert.strictEqual(refs.length, 3);
});

test("finds enum member qualified references", () => {
  const text = `
STATES state = STATES.West_Coast;
if (state == STATES.Inland) {}
`;
  const refs = findReferencesInText(text, {
    name: "West_Coast",
    kind: "enumMember",
    containerName: "STATES",
  });
  assert.strictEqual(refs.length, 1);
  assert.strictEqual(refs[0].start.line, 1);
});

test("finds validator including annotation form", () => {
  const text = `
validator requiredFieldValidator { notnull(); }
@requiredFieldValidator("msg")
string name;
`;
  const refs = findReferencesInText(text, {
    name: "requiredFieldValidator",
    kind: "validator",
  });
  assert.ok(refs.length >= 2);
});

test("ignores matches inside strings and comments", () => {
  const text = `
Shop shop;
// Shop mentioned here
string x = "Shop";
`;
  const refs = findReferencesInText(text, { name: "Shop", kind: "object" });
  assert.strictEqual(refs.length, 1);
});

console.log("\nAll reference finder tests passed.");
