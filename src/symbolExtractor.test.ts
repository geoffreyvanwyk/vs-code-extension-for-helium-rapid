import * as assert from "assert";
import { extractSymbols, maskNoise, positionToOffset } from "./symbolExtractor";

function byKind(kind: string) {
  return (s: { kind: string; name: string }) => s.kind === kind;
}

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
	@ManyToMany
	ShopOwner owners via shops;
}
`;

const enumSource = `
enum STATES {
	West_Coast,
	South_Coast,
	Inland
}
`;

const unitSource = `
unit ShopMgmt;

Shop shop;
ShopOwner ownerToAdd;
bool editing;

void init() {
	shop = Shop:new();
	ownerToAdd = null;
	shop.shopCode = generateShopCode();
	editing = false;
}

string generateShopCode() {
	string shopId = shop._id;
	return shopId;
}

Shop[] getShops() {
	return Shop:equals(deleted, false);
}
`;

const validatorSource = `
validator requiredFieldValidator {
	notnull();
}
`;

test("maskNoise preserves offsets for code", () => {
  const src = 'string x = "hi"; // comment\nShop y;';
  const masked = maskNoise(src);
  assert.strictEqual(masked.length, src.length);
  assert.ok(masked.includes("Shop"));
  assert.ok(!masked.includes("hi"));
  assert.ok(!masked.includes("comment"));
});

test("extracts object and attributes", () => {
  const { symbols } = extractSymbols(shopSource);
  const objects = symbols.filter(byKind("object"));
  assert.strictEqual(objects.length, 1);
  assert.strictEqual(objects[0].name, "Shop");

  const attrs = symbols.filter(byKind("attribute"));
  const names = attrs.map((a) => a.name).sort();
  assert.deepStrictEqual(names, ["name", "owners", "shopCode", "state"]);

  const state = attrs.find((a) => a.name === "state");
  assert.strictEqual(state?.typeName, "STATES");
  assert.strictEqual(state?.containerName, "Shop");

  const owners = attrs.find((a) => a.name === "owners");
  assert.strictEqual(owners?.typeName, "ShopOwner");
});

test("extracts enum and members", () => {
  const { symbols } = extractSymbols(enumSource);
  assert.strictEqual(symbols.filter(byKind("enum"))[0]?.name, "STATES");
  const members = symbols.filter(byKind("enumMember")).map((m) => m.name);
  assert.deepStrictEqual(members, ["West_Coast", "South_Coast", "Inland"]);
});

test("extracts unit, variables, and functions", () => {
  const { symbols } = extractSymbols(unitSource);
  assert.strictEqual(symbols.filter(byKind("unit"))[0]?.name, "ShopMgmt");

  const vars = symbols.filter(byKind("variable"));
  assert.ok(vars.some((v) => v.name === "shop" && v.typeName === "Shop"));
  assert.ok(vars.some((v) => v.name === "editing" && v.typeName === "bool"));
  assert.ok(vars.some((v) => v.name === "shopId" && v.typeName === "string"));

  const fns = symbols.filter(byKind("function")).map((f) => f.name).sort();
  assert.deepStrictEqual(fns, ["generateShopCode", "getShops", "init"]);

  const init = symbols.find((s) => s.kind === "function" && s.name === "init");
  assert.strictEqual(init?.returnType, "void");
  assert.deepStrictEqual(init?.parameters, []);
});

test("extracts validator", () => {
  const { symbols } = extractSymbols(validatorSource);
  assert.strictEqual(symbols.filter(byKind("validator"))[0]?.name, "requiredFieldValidator");
});

test("enclosingObjectAt finds object body", () => {
  const result = extractSymbols(shopSource);
  const offset = shopSource.indexOf("shopCode");
  assert.strictEqual(result.enclosingObjectAt(offset), "Shop");
  assert.strictEqual(result.enclosingObjectAt(0), undefined);
});

test("positionToOffset round-trips", () => {
  const text = "a\nbc\n";
  assert.strictEqual(positionToOffset(text, 1, 1), 3);
});

console.log("\nAll extractor tests passed.");
