import { copyFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "client", "public", "catalog");
mkdirSync(outDir, { recursive: true });
copyFileSync(resolve(root, "api", "_games.json"), resolve(outDir, "games.json"));
console.log("Copied api/_games.json -> client/public/catalog/games.json");