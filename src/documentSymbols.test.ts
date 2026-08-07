import * as assert from "assert";
import { extractSymbols } from "./symbolExtractor";
import { buildDocumentOutline } from "./documentSymbols";

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`fail - ${name}`);
    throw err;
  }
}

const shopSource = `
persistent object Shop {
	string shopCode;
	string name;
	STATES state;
}
`;

const unitSource = `
unit ShopMgmt;

Shop shop;
bool editing;

void init() {
	string shopId = shop._id;
	editing = false;
}

string generateShopCode() {
	return "x";
}
`;

const enumSource = `
enum STATES {
	West_Coast,
	South_Coast,
	Inland
}
`;

test("nests attributes under object", () => {
  const { symbols } = extractSymbols(shopSource);
  const outline = buildDocumentOutline(symbols, shopSource.length);
  assert.strictEqual(outline.length, 1);
  assert.strictEqual(outline[0].name, "Shop");
  assert.strictEqual(outline[0].kind, "object");
  assert.deepStrictEqual(
    outline[0].children.map((c) => c.name),
    ["shopCode", "name", "state"]
  );
  assert.ok(outline[0].children.every((c) => c.kind === "attribute"));
});

test("nests enum members under enum", () => {
  const { symbols } = extractSymbols(enumSource);
  const outline = buildDocumentOutline(symbols, enumSource.length);
  assert.strictEqual(outline.length, 1);
  assert.strictEqual(outline[0].name, "STATES");
  assert.deepStrictEqual(
    outline[0].children.map((c) => c.name),
    ["West_Coast", "South_Coast", "Inland"]
  );
});

test("lists unit, variables, and functions; omits locals", () => {
  const { symbols } = extractSymbols(unitSource);
  const outline = buildDocumentOutline(symbols, unitSource.length);
  const names = outline.map((n) => n.name);
  assert.deepStrictEqual(names, ["ShopMgmt", "shop", "editing", "init", "generateShopCode"]);
  assert.ok(!names.includes("shopId"));
  assert.strictEqual(outline.find((n) => n.name === "shop")?.detail, "Shop");
  assert.strictEqual(outline.find((n) => n.name === "init")?.kind, "function");
});

console.log("\nAll document symbol tests passed.");
