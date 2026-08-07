import * as fs from "fs";
import * as path from "path";
import { extractSymbols } from "./symbolExtractor";

const tutorial = path.resolve(__dirname, "../../tutorial");
const files = [
  "model/objects/Shop.mez",
  "model/enums/Enums.mez",
  "model/validators/Validators.mez",
  "web-app/presenters/entity_management/ShopMgmt.mez",
];

for (const rel of files) {
  const text = fs.readFileSync(path.join(tutorial, rel), "utf8");
  const { symbols } = extractSymbols(text);
  const summary = symbols.reduce<Record<string, number>>((acc, s) => {
    acc[s.kind] = (acc[s.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(rel, summary);
  if (rel.includes("Shop.mez") && !symbols.some((s) => s.kind === "object" && s.name === "Shop")) {
    throw new Error("Shop object missing");
  }
  if (rel.includes("ShopMgmt") && !symbols.some((s) => s.name === "init" && s.kind === "function")) {
    throw new Error("init function missing");
  }
  if (rel.includes("ShopMgmt") && !symbols.some((s) => s.name === "shop" && s.typeName === "Shop")) {
    throw new Error("shop variable missing");
  }
}

console.log("smoke check ok");
