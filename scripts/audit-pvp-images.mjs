import fs from "fs";
import path from "path";

const src = fs.readFileSync("client/src/data/portalProducts.ts", "utf8");
const arenaArt = fs.readFileSync("client/src/data/arenaArt.ts", "utf8");

const products = [];
const re = /id: "([^"]+)"[\s\S]*?tags: \[([^\]]+)\]/g;
for (const m of src.matchAll(re)) {
  const tags = m[2];
  if (/pvp|pvpve|coop|arena/.test(tags)) {
    products.push(m[1]);
  }
}

const getProductImage = (id) => {
  const block = src.split(`id: "${id}"`)[1];
  if (!block) return null;
  const im = block.match(/image: "([^"]+)"/);
  return im ? im[1] : null;
};

const getOverride = (id) => {
  const m = arenaArt.match(new RegExp(`"${id}": "([^"]+)"`));
  return m ? m[1] : null;
};

const pub = "client/public";
const missing = [];

for (const id of [...new Set(products)]) {
  const img = getProductImage(id);
  const url = img && img !== "/assets/store/scifi_environment.png" ? img : getOverride(id);
  if (!url) continue;
  const file = path.join(pub, url.replace(/^\//, ""));
  if (!fs.existsSync(file)) missing.push({ id, url, file });
}

console.log(`PvP-tagged products: ${products.length}`);
console.log(`Missing image files: ${missing.length}`);
for (const m of missing) console.log(`- ${m.id}: ${m.url}`);