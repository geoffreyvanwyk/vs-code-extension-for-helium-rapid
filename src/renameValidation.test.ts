import * as assert from "assert";
import { validateNewName } from "./renameValidation";

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`fail - ${name}`);
    throw err;
  }
}

test("accepts valid identifier", () => {
  assert.strictEqual(validateNewName("ShopStore", "Shop"), undefined);
  assert.strictEqual(validateNewName("shop_code", "shopCode"), undefined);
});

test("rejects same name", () => {
  assert.ok(validateNewName("Shop", "Shop"));
});

test("rejects invalid identifiers", () => {
  assert.ok(validateNewName("123bad", "Shop"));
  assert.ok(validateNewName("shop-code", "shopCode"));
  assert.ok(validateNewName("", "Shop"));
});

test("rejects reserved words", () => {
  assert.ok(validateNewName("object", "Shop"));
  assert.ok(validateNewName("string", "name"));
  assert.ok(validateNewName("return", "init"));
});

console.log("\nAll rename validation tests passed.");
